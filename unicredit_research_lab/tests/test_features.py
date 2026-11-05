"""Causal feature tests using literal prices and per-clock volume fixtures."""
import unittest
import numpy as np
import pandas as pd
from pandas.testing import assert_frame_equal
from ucg_lab.data import Dataset
from ucg_lab.features import build_features, FEATURE_COLUMNS


def fixture(days=3, minutes=70):
    sessions=[]
    bars=[]
    for d in range(days):
        opening=pd.Timestamp('2025-01-02T08:00:00Z')+pd.Timedelta(days=d)
        sessions.append(dict(session_date=opening.strftime('%Y-%m-%d'),open=opening,close=opening+pd.Timedelta(minutes=minutes)))
        for m in range(minutes):
            price=100+d*10+m
            bars.append(dict(timestamp=opening+pd.Timedelta(minutes=m),open=price,high=price+1,low=price-1,close=price,volume=(d+1)*(m//5+1)))
    return Dataset(pd.DataFrame(bars),pd.DataFrame(sessions),{'data_kind':'synthetic'},'fixture',{})


class FeatureTests(unittest.TestCase):
    config=dict(volume_lookback_sessions=2,min_volume_history_sessions=2)

    def test_completed_buckets_are_anchored_to_session_open(self):
        data=fixture(days=1,minutes=12)
        delta=pd.Timedelta(minutes=2)
        data.bars.timestamp+=delta
        data.sessions.open+=delta
        data.sessions.close+=delta
        features=build_features(data,self.config)
        self.assertEqual(len(features),2)
        self.assertEqual(features.iloc[0].decision_time,pd.Timestamp('2025-01-02T08:07:00Z'))
        self.assertEqual(features.iloc[0].last_price,104)
        self.assertEqual(features.iloc[-1].decision_time,pd.Timestamp('2025-01-02T08:12:00Z'))

    def test_same_clock_interval_and_cumulative_volume_are_causal(self):
        data=fixture()
        features=build_features(data,self.config)
        last=features[features.session_date=='2025-01-04']
        self.assertTrue(last.rvol_ready.all())
        np.testing.assert_allclose(last.rvol,2.)
        np.testing.assert_allclose(last.cumulative_rvol,2.)
        self.assertFalse(features[features.session_date<'2025-01-04'].rvol_ready.any())
        # Earlier sessions: bucket 0 = 5 and 10; bucket 1 = 10 and 20.
        # Current: bucket 0=15, bucket 1=300; cumulative =315 / mean(15,30)=14.
        mask=(data.bars.timestamp.dt.date==pd.Timestamp('2025-01-04').date()) & (data.bars.timestamp.dt.minute.between(5,9))
        data.bars.loc[mask,'volume']=60.
        last=build_features(data,self.config).query("session_date == '2025-01-04'")
        self.assertAlmostEqual(last.iloc[1].rvol,20.)
        self.assertAlmostEqual(last.iloc[1].cumulative_rvol,14.)

    def test_volume_lookback_is_number_of_previous_sessions(self):
        data=fixture(days=4)
        data.bars.loc[data.bars.timestamp.dt.day==2,'volume']=10000
        features=build_features(data,self.config)
        last=features.query("session_date == '2025-01-05'")
        np.testing.assert_allclose(last.rvol,4/2.5)

    def test_future_price_volume_context_news_mutations_do_not_change_past(self):
        data=fixture()
        boundary=pd.Timestamp('2025-01-03T08:20:00Z')
        data.context=pd.DataFrame(dict(available_at=[boundary-pd.Timedelta(minutes=3),boundary+pd.Timedelta(minutes=2)],market_return_15m=[.01,.02],sector_return_15m=[.03,.04]))
        data.news=pd.DataFrame(dict(event_id=['a','b'],published_at=[boundary-pd.Timedelta(minutes=10),boundary],available_at=[boundary-pd.Timedelta(minutes=2),boundary+pd.Timedelta(minutes=2)],event_type=['fixture','fixture']))
        before=build_features(data,self.config)
        future=data.bars.timestamp>=boundary
        for column in ['open','high','low','close']: data.bars.loc[future,column]*=9
        data.bars.loc[future,'volume']*=7
        data.context.loc[1,'market_return_15m']=999
        data.news.loc[1,'event_id']='changed-future'
        after=build_features(data,self.config)
        assert_frame_equal(before[before.decision_time<=boundary],after[after.decision_time<=boundary])

    def test_opening_range_is_unavailable_until_30_minutes_then_frozen(self):
        data=fixture(days=1)
        features=build_features(data,self.config)
        self.assertFalse(features.iloc[:5].opening_range_ready.any())
        self.assertTrue(features.iloc[:5].opening_range_high.isna().all())
        self.assertTrue(features.iloc[5:].opening_range_ready.all())
        np.testing.assert_allclose(features.iloc[5:].opening_range_high,130.)
        np.testing.assert_allclose(features.iloc[5:].opening_range_low,99.)

    def test_session_returns_and_close_times_have_hand_checked_values(self):
        features=build_features(fixture(),self.config)
        first=features.query("session_date == '2025-01-02'")
        second=features.query("session_date == '2025-01-03'")
        self.assertTrue(np.isnan(first.iloc[0].return_5m))
        self.assertAlmostEqual(first.iloc[1].return_5m,109/104-1)
        self.assertAlmostEqual(first.iloc[3].return_15m,119/104-1)
        self.assertAlmostEqual(first.iloc[12].return_60m,164/104-1)
        self.assertTrue(np.isnan(second.iloc[0].return_5m))
        self.assertAlmostEqual(second.iloc[0].gap_return,110/169-1)
        self.assertAlmostEqual(second.iloc[0].day_return,114/110-1)
        self.assertTrue(np.isnan(first.iloc[0].gap_return))
        self.assertAlmostEqual(first.iloc[0].range_5m,6/104)
        self.assertAlmostEqual(first.iloc[0].vwap_distance,104/102-1)

    def test_zero_volume_does_not_produce_infinite_values_or_ready_history(self):
        data=fixture()
        data.bars.volume=0.
        features=build_features(data,self.config)
        self.assertFalse(features.rvol_ready.any())
        self.assertTrue(features.rvol.isna().all())
        self.assertTrue(features.cumulative_rvol.isna().all())
        self.assertTrue(features.vwap_distance.isna().all())
        self.assertFalse(np.isinf(features[FEATURE_COLUMNS].to_numpy(dtype=float)).any())

    def test_event_window_uses_availability_and_deduplicates_ids(self):
        data=fixture(days=1,minutes=70)
        data.news=pd.DataFrame(dict(event_id=['old','on','future','on'],published_at=pd.to_datetime(['2025-01-02T06:00:00Z','2025-01-02T06:00:00Z','2025-01-02T06:00:00Z','2025-01-02T06:00:00Z']),available_at=pd.to_datetime(['2025-01-02T07:05:00Z','2025-01-02T08:05:00Z','2025-01-02T08:06:00Z','2025-01-02T08:05:00Z']),event_type=['fixture']*4))
        features=build_features(data,self.config)
        self.assertEqual(features.iloc[0].news_count_60m,1)  # (t-60m,t], lower edge excluded.
        self.assertEqual(features.iloc[1].news_count_60m,2)
        self.assertTrue(features.news_available.eq(1).all())
        absent=build_features(fixture(days=1),self.config)
        self.assertTrue(absent.news_count_60m.eq(0).all())
        self.assertTrue(absent.news_available.eq(0).all())

    def test_context_is_asof_available_time_with_freshness_limit(self):
        data=fixture(days=1)
        data.context=pd.DataFrame(dict(available_at=pd.to_datetime(['2025-01-02T08:05:00Z','2025-01-02T08:26:00Z']),market_return_15m=[.01,.03],sector_return_15m=[.02,.04]))
        features=build_features(data,self.config)
        self.assertEqual(features.iloc[0].market_return_15m,.01)
        self.assertEqual(features.iloc[3].context_available,1)  # 15m exact age is valid.
        self.assertEqual(features.iloc[4].context_available,0)
        self.assertEqual(features.iloc[4].market_return_15m,0)
        self.assertEqual(features.iloc[5].market_return_15m,.03)

    def test_input_frames_are_unchanged_and_export_excludes_nonfeatures(self):
        data=fixture()
        original_bars=data.bars.copy(deep=True)
        original_sessions=data.sessions.copy(deep=True)
        features=build_features(data,self.config)
        assert_frame_equal(data.bars,original_bars)
        assert_frame_equal(data.sessions,original_sessions)
        self.assertTrue(set(FEATURE_COLUMNS)<=set(features.columns))
        self.assertFalse({'last_price','decision_time','opening_range_high','opening_range_low','rvol_ready','opening_range_ready'}&set(FEATURE_COLUMNS))

    def test_finite_inputs_that_overflow_turnover_are_rejected(self):
        data=fixture(days=1,minutes=5)
        for column,value in (('open',100.),('high',101.),('low',99.),('close',100.),('volume',1e307)):
            data.bars[column]=value
        with self.assertRaisesRegex(ValueError,'overflow|nonfinite|arithmetic'):
            build_features(data,self.config)

    def test_large_integer_volume_does_not_wrap_cumulative_sums(self):
        data=fixture(days=1,minutes=5)
        for column,value in (('open',100.),('high',101.),('low',99.),('close',100.)):
            data.bars[column]=value
        data.bars['volume']=np.int64(4_000_000_000_000_000_000)
        features=build_features(data,self.config)
        self.assertAlmostEqual(features.iloc[0].vwap_distance,0.)

    def test_bad_config_and_missing_minutes_are_rejected(self):
        for config in ({'bar_minutes':1},{'volume_lookback_sessions':0},{'min_volume_history_sessions':0},{'context_max_age_minutes':-1}):
            with self.subTest(config=config):
                with self.assertRaises(ValueError): build_features(fixture(),config)
        data=fixture()
        data.bars=data.bars.drop(2)
        with self.assertRaises(ValueError): build_features(data,self.config)

if __name__=='__main__': unittest.main()

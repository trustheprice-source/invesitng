import tempfile
import unittest
from pathlib import Path

from ucg_lab.paper import PaperBroker


class PaperTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.broker = PaperBroker(Path(self.tmp.name) / 'paper.sqlite', {'mode':'simulation','data_kind':'synthetic',
                                   'frozen_hash':'test','slippage_bps_per_side':0.0})

    def tearDown(self):
        self.tmp.cleanup()

    def quote(self, qid, stamp, bid=19.99, ask=20.0, size=100):
        return {'quote_id':qid,'timestamp':stamp,'symbol':'UCG','bid':bid,'ask':ask,'bid_size':size,'ask_size':size}

    def test_delayed_whole_share_round_trip_and_minimum_fees(self):
        self.broker.submit('buy','buy',10,'2026-11-05T10:00:00Z',now='2026-11-05T10:00:00Z')
        self.assertEqual(self.broker.on_quote(self.quote('early','2026-11-05T10:00:30Z'),now='2026-11-05T10:00:30Z'), [])
        self.assertEqual(len(self.broker.on_quote(self.quote('entry','2026-11-05T10:01:00Z'),now='2026-11-05T10:01:00Z')),1)
        self.assertAlmostEqual(self.broker.snapshot()['cash'],9797)
        self.broker.submit('sell','sell',10,'2026-11-05T10:02:00Z',now='2026-11-05T10:02:00Z')
        self.broker.on_quote(self.quote('exit','2026-11-05T10:03:00Z',bid=21,ask=21.01),now='2026-11-05T10:03:00Z')
        snapshot = self.broker.snapshot()
        self.assertAlmostEqual(snapshot['cash'],10004)
        self.assertEqual(snapshot['quantity'],0)
        self.assertFalse(snapshot['eligible_for_live'])

    def test_duplicate_order_and_quote_are_idempotent(self):
        args=('buy','buy',10,'2026-11-05T10:00:00Z')
        self.assertTrue(self.broker.submit(*args,now=args[3]))
        self.assertFalse(self.broker.submit(*args,now=args[3]))
        quote=self.quote('entry','2026-11-05T10:01:00Z')
        self.broker.on_quote(quote,now=quote['timestamp'])
        self.assertEqual(self.broker.on_quote(quote,now='2026-11-05T10:05:00Z'),[])
        self.assertEqual(len(self.broker.snapshot()['fills']),1)
        with self.assertRaises(ValueError):
            self.broker.submit('buy','buy',11,args[3],now=args[3])

    def test_stale_future_crossed_and_unavailable_depth_never_fill(self):
        self.broker.submit('buy','buy',10,'2026-11-05T10:00:00Z',now='2026-11-05T10:00:00Z')
        cases=[(self.quote('stale','2026-11-05T10:01:00Z'),'2026-11-05T10:03:00Z'),
               (self.quote('future','2026-11-05T10:04:00Z'),'2026-11-05T10:03:00Z'),
               (self.quote('crossed','2026-11-05T10:01:00Z',bid=21,ask=20),'2026-11-05T10:01:00Z')]
        for quote, now in cases:
            with self.assertRaises(ValueError): self.broker.on_quote(quote,now=now)
        self.assertEqual(self.broker.on_quote(self.quote('thin','2026-11-05T10:01:00Z',size=0),now='2026-11-05T10:01:00Z'),[])
        self.assertEqual(self.broker.snapshot()['quantity'],0)

    def test_rejects_shorting_and_synthetic_prospective_claim(self):
        with self.assertRaises(ValueError):
            self.broker.submit('short','sell',1,'2026-11-05T10:00:00Z',now='2026-11-05T10:00:00Z')
        with self.assertRaises(ValueError):
            PaperBroker(Path(self.tmp.name)/'invalid.sqlite',{'mode':'prospective','data_kind':'synthetic','frozen_hash':'x'})

    def test_order_cannot_exceed_capital_allocation(self):
        self.broker.submit('big','buy',200,'2026-11-05T10:00:00Z',now='2026-11-05T10:00:00Z')
        self.assertEqual(self.broker.on_quote(self.quote('q','2026-11-05T10:01:00Z',size=1000),now='2026-11-05T10:01:00Z'),[])
        self.assertEqual(self.broker.snapshot()['orders'][0]['status'],'REJECTED')
        self.assertEqual(self.broker.snapshot()['cash'],10000)

    def test_unfilled_old_signal_expires_before_later_quote(self):
        self.broker.submit('old','buy',10,'2026-11-05T10:00:00Z',now='2026-11-05T10:00:00Z')
        self.assertEqual(self.broker.on_quote(self.quote('later','2026-11-05T11:00:00Z'),now='2026-11-05T11:00:00Z'),[])
        self.assertEqual(self.broker.snapshot()['orders'][0]['status'],'EXPIRED')
        self.assertEqual(self.broker.snapshot()['quantity'],0)


if __name__ == '__main__': unittest.main()

import copy
import unittest

from ucg_lab.config import DEFAULT_CONFIG, validate_config


class ConfigTests(unittest.TestCase):
    def test_rejects_zero_latency_and_leverage(self):
        for key, value in [('latency_minutes', 0), ('allocation_fraction', 1.1)]:
            config = copy.deepcopy(DEFAULT_CONFIG)
            config['execution'][key] = value
            with self.assertRaises(ValueError):
                validate_config(config)

    def test_rejects_more_candidates_than_registered_budget(self):
        config = copy.deepcopy(DEFAULT_CONFIG)
        config['research']['max_trials'] = 1
        with self.assertRaises(ValueError):
            validate_config(config)

    def test_rejects_unknown_keys_and_live_mode(self):
        for key, value in [('live_trading', True), ('typo', 4)]:
            config = copy.deepcopy(DEFAULT_CONFIG)
            config[key] = value
            with self.assertRaises(ValueError):
                validate_config(config)

    def test_valid_config_is_copied_and_finite(self):
        original = copy.deepcopy(DEFAULT_CONFIG)
        result = validate_config(original)
        result['execution']['initial_cash'] = 7
        self.assertEqual(original['execution']['initial_cash'], 10000.0)
        original['execution']['minimum_commission'] = float('nan')
        with self.assertRaises(ValueError):
            validate_config(original)


if __name__ == '__main__':
    unittest.main()

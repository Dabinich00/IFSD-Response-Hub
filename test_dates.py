import unittest
from date_fields import normalize_date
import extraction
import database

class DateTests(unittest.TestCase):
    def test_formats_and_time(self):
        for raw,wanted in [('22, 11, 26','22.11.2026'),('2026-11-22','22.11.2026'),('1.2.2028','01.02.2028'),('2026-11-22 at 08:00 UTC','22.11.2026 08:00 UTC'),('2026-11-22T08:00:00+01:00','22.11.2026 08:00:00+01:00'),('29.02.2028','29.02.2028'),('','')]:
            self.assertEqual(normalize_date(raw),wanted)
    def test_reject_invalid_and_relative(self):
        for raw in ['yesterday','Вчера','22.11','31.02.2026','29.02.2027','22.11.2026 25:00','22.11.2026 maybe']:
            with self.assertRaises(ValueError):normalize_date(raw)
    def test_model_dates_are_normalized_or_flagged(self):
        fields={key:None for key in extraction.FIELDS}
        result=extraction.validate({**fields,'eventTime':'Вчера','requestedDepartureDate':'22, 11, 26'})
        self.assertEqual(result['eventTime'],'')
        self.assertEqual(result['requestedDepartureDate'],'22.11.2026')
        self.assertIn('Please confirm the event date',result['assistantSuggestions'])
    def test_manual_save_validation(self):
        row=database.validate({'source':'Email','problemNotes':'Test','eventTime':'2026-11-03 09:00 UTC','requestedDepartureDate':'22, 11, 26'})
        self.assertEqual(row['eventTime'],'03.11.2026 09:00 UTC')
        self.assertEqual(row['requestedDepartureDate'],'22.11.2026')
        with self.assertRaises(ValueError):database.validate({**row,'eventTime':'yesterday'})
if __name__=='__main__':unittest.main()

import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from fetch_go_nieuw import GoNieuwFetcher

class GoNieuwProvenanceTests(unittest.TestCase):
    def test_excel_source_url_is_preserved_on_each_goal(self):
        with tempfile.TemporaryDirectory() as directory:
            source=Path(directory)/'synthetic.xlsx';source.touch()
            link={'local_path':str(source),'url':'https://example.test/actual.xlsx','label':'Doelenset BaO Nederlands','discipline':'Nederlands','doelenset_nummer':'1'}
            fetcher=GoNieuwFetcher(output=Path(directory)/'out.jsonl')
            with patch.object(fetcher,'_parse_excel_file',return_value=[{'code':'SYN.1','titel':'Synthetisch doel'}]):
                records=fetcher._parse_all_excel_files([link])
            self.assertEqual(records[0].get('bron_url'),link['url'])
            self.assertEqual(records[0].get('bron_titel'),link['label'])

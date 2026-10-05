import io
import os
import subprocess
import unittest
from unittest.mock import patch
from confined_reporting import memory_reporter


class Tests(unittest.TestCase):
    def test_success_failure_and_cleanup_have_no_filesystem_fallback(self):
        calls=[]
        def denied(*args,**kwargs):
            calls.append(args)
            raise AssertionError('HARD_DENY')
        source='def fail(self):\n    self.assertEqual(1,2)\n'
        scope={}
        exec(compile(source,'/virtual/own_test.py','exec'),scope)
        guards=[patch.object(os,'stat',denied),patch.object(os,'open',denied),
                patch.object(subprocess,'Popen',denied),*memory_reporter({'/virtual/own_test.py':source})]
        for guard in guards:guard.start()
        try:
            for fail in (False,True):
                case=type('Case',(unittest.TestCase,),{'runTest':scope['fail'] if fail else lambda self:None})
                result=unittest.TextTestRunner(stream=io.StringIO()).run(case())
                self.assertEqual(result.wasSuccessful(),not fail)
            self.assertEqual(calls,[])
            # Fake cleanup attempts are intercepted while all guards remain.
            with self.assertRaisesRegex(AssertionError,'HARD_DENY'):os.stat('/virtual/cleanup')
            with self.assertRaisesRegex(AssertionError,'HARD_DENY'):subprocess.Popen(['not-executed'])
            self.assertEqual(calls,[('/virtual/cleanup',),(['not-executed'],)])
        finally:
            for guard in reversed(guards):guard.stop()

if __name__=='__main__':unittest.main()

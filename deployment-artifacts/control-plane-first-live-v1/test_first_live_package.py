import copy
import unittest
import first_live_package as p


def packet():
    return {'lifecycle':{'app_inventory_sha256':'1'*64,'harness_inventory_sha256':'2'*64,
        'node_inventory_sha256':'3'*64,'node_payloads':{'bin/node':'4'*64,**{'lib/lib%02d.dylib'%i:('%064x'%(i+16)) for i in range(21)}},
        'retired_binary_sha256':'5'*64},'controller_sha256':'6'*64,'review_helper_sha256':'7'*64}


class Mapping(unittest.TestCase):
    def test_native_fixed_filenames_and_all_real_payloads(self):
        x=p.inputs(packet())
        self.assertEqual(x['node-inventory.json'],'3'*64)
        self.assertEqual(x['payloads/'+'5'*64],'5'*64)
        self.assertEqual(len([k for k in x if k.startswith('payloads/')]),23)
        self.assertEqual(x['agent-deploy-issuer'],'7'*64)
        self.assertEqual(x['tailscaled'],'5d9c03785aa534b0bd42071f1b7632474ae932e876dcaa7fd3866f685010d8da')

    def test_bad_or_incomplete_payload_closure_never_yields_install_plan(self):
        x=packet();del x['lifecycle']['node_payloads']['bin/node']
        with self.assertRaises((ValueError,RuntimeError)):p.inputs(x)
        x=packet();x['lifecycle']['retired_binary_sha256']='../other'
        with self.assertRaises((ValueError,RuntimeError)):p.inputs(x)


if __name__=='__main__':unittest.main()

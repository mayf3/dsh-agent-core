import copy
import unittest
import first_live_package as p


def packet():
    return {'lifecycle':{'app_inventory_sha256':'1'*64,'harness_inventory_sha256':'2'*64,
        'node_inventory_sha256':'3'*64,'node_payloads':{'bin/node':'4'*64,**{'lib/lib%02d.dylib'%i:('%064x'%(i+16)) for i in range(21)}},
        'retired_binary_sha256':'5'*64},'controller_sha256':'6'*64,'review_helper_sha256':'7'*64}


class Mapping(unittest.TestCase):
    def test_fixed_successor_identity_and_predecessor_binding(self):
        self.assertEqual(p.EXECUTION_ID,'first-live-dsh-20260918-01-p4r10-successor')
        self.assertEqual(p.PREDECESSOR['operation_id'],p.OPERATION)
        self.assertEqual(p.PREDECESSOR['execution_id'],'first-live-dsh-20260918-01-p4-successor')
        self.assertEqual(p.PREDECESSOR['package_sha256'],'d320d4b27bcda875e459129ae6e449146295c4d6357677874678ef3b83d0090c')
        self.assertEqual(p.PREDECESSOR['plan_sha256'],'b2d2473360f4b760603fc99df2e06f16484b05de57654fa12500535b373f7761')
        self.assertEqual(p.PREDECESSOR['stop_class'],'LEGACY_LOCK_ANCESTOR_RENAME')
        self.assertIs(p.PREDECESSOR['consumed'],True)
        self.assertIs(p.PREDECESSOR['retry_forbidden'],True)
        self.assertIs(p.PREDECESSOR['production_mutation_performed'],False)
        self.assertIs(p.PREDECESSOR['fresh_production_revalidation_required'],True)
        self.assertIs(p.PREDECESSOR['new_owner_authorization_required'],True)

    def test_fixed_codex_stream_spec_has_exact_size_and_no_subprocess_read_command(self):
        x=packet();x['previous']={k:'a'*64 for k in ['installation_receipt_sha256','service_sha256',
            'trust_sha256','issuer_policy_sha256','registry_sha256']}
        codex=p.CODE+'/codex';spec=p.prefix_files(x)[codex]
        self.assertEqual((spec['sha256'],spec['size']),
            ('b973d440acac501fd2594a43e7ca9ce41e0a65b9dfb28d0d7a7837c99e1261e3',220584000))
        commands=p.commands(x,'8'*64)
        self.assertNotIn(['/bin/cat',codex],commands)
        self.assertIn(['/usr/bin/stat','-f',p.STAT_FORMAT,codex],commands)
        self.assertIn(['/bin/ls','-ldeO',codex],commands)
        self.assertIn(['/bin/cat',p.CODE+'/agent-deployd'],commands)
        postimage=p.PACKET+'/original-agent-deployd'
        self.assertIn(['/usr/bin/stat','-f',p.STAT_FORMAT,postimage],commands)
        self.assertIn(['/bin/ls','-ldeO',postimage],commands)

    def test_reconciliation_commands_cover_new_source_tools_and_active_copy_readback(self):
        x=packet();x['previous']={k:'a'*64 for k in ['installation_receipt_sha256','service_sha256',
            'trust_sha256','issuer_policy_sha256','registry_sha256']}
        rec={'staging_files':{'packet.json':{'sha256':'8'*64}}}
        commands=p.commands(x,'9'*64,rec)
        active=p.ROOT+'/first-live-operation/successor-reconciliation.json'
        self.assertIn(['/usr/bin/stat','-f',p.STAT_FORMAT,active],commands)
        self.assertIn(['/bin/ls','-ldeO',active],commands)
        self.assertIn(['/bin/cat',active],commands)
        self.assertIn(['/bin/mv',p.PACKET,p.P4R9_PACKET_ARCHIVE],commands)
        self.assertIn(['/bin/sync'],commands)
        for name in ['original-agent-deployd','original-agent-deploy-issuer']:
            archived=p.P4R9_PACKET_ARCHIVE+'/'+name
            self.assertIn(['/usr/bin/stat','-f',p.STAT_FORMAT,archived],commands)
            self.assertIn(['/bin/ls','-ldeO',archived],commands)
            self.assertIn(['/bin/cat',archived],commands)
        self.assertEqual(len(commands),len({tuple(row) for row in commands}))

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

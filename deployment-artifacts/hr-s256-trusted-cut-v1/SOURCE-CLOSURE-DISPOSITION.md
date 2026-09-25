# Fixed s256 source-closure disposition (nonproduction static pass)

`SOURCE_CLOSURE_PROVEN=NO`; the fixed DS candidate remains inert. This note is
not an execution authority or a claim about the current live host.

The possible application-level admission point is the Runtime startup path
before it opens the Router durable store or business admission. A root DS
launcher could pass a one-use, root-held window descriptor and challenge to a
reviewed successor binary; a same-UID manual launch of **that binary** without
the descriptor would fail before Router startup. This fits the R2 allowance
for authenticated Router startup wiring and would not require an application,
config, or plist write *during the cut*. It would require reviewed successor
application bytes at installation, plus a fixed negative test for direct
manual entry without the descriptor. No such startup gate is implemented or
installed in this candidate.

That gate alone cannot prove the R2 `LaunchSourceClosure`. A same-UID actor may
execute an older installed Runtime entry, a copied binary, or another entry
that never enters the new gate. The frozen v5 DS flock and fixed launchd label
cannot exclude those executions. Current installed executable/entrypoint
inventory and permissions have not been read, so there is no bounded manifest
showing those routes absent or denied. A synthetic test of the successor gate
would therefore show only its local behavior, not whole-host exclusion.

The exact unresolved interface is a reviewed, continuously enforced denial
or admission for **every** executable Runtime/DSH startup route of the Runtime
UID from source inhibition through both censuses, the sole authorized launch,
Router consumption and readback. If current protected facts prove a finite set
of controllable routes, R2 already requires their manifest and inhibition;
implementation and independent review may proceed against that exact set.
In particular, a fresh whole-host census proving **zero processes of the
Runtime UID** after stop, together with continuous closure of *all* launchd,
cron, login, helper, manual, and root-writer routes that can create that UID,
would exclude a direct same-UID manual exec during the window: there would be
no resident same-UID actor to issue it and no remaining entry to create one.
This is a conditional proof shape only. The existing collector tests show an
unlisted UID-505 actor that is absent from the old-PID set; the old-PID and
holder checks report zero while that actor remains able to exec. The current
source manifest and any continuous denial have not been established, so the
condition is not satisfied by this candidate.
If a same-UID arbitrary manual exec route remains, a mandatory host execution
policy or equivalent trusted launch gate covering it would be a new effect
outside the accepted R2 list, which permits no application/config/plist write
during the operation and names no host execution-policy mutation. That
specific additional effect and its safe rollback would need an Owner contract
delta before implementation or bootstrap. No `complete:true`, DS lock,
launchctl status, previous zero census, or caller challenge substitutes for
this enforced boundary.

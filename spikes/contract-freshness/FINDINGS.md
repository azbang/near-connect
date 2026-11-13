Claim: On NEAR testnet, `view_account` at current finality and at a timestamp 24 hours earlier can distinguish account creation and deployed code state using the public dRPC endpoint.
Verdict: CONFIRMED for historical state reads on the sampled account; height is not a reliable time proxy.
Measured: At final height 277,521,949, `wrap.testnet` existed at heights 277,435,549 and 277,521,949 with the same code hash `DsbyUrKaSJAT91Pewfi71QExPLBooDp1z4sL9GUDhNHa`. Command: the inline Node JSON-RPC probe against `https://near-testnet.drpc.org`.
Negative case: Not yet run against an account created in the last 24 hours.
Caveat: This provider advanced 86,400 heights in 50,985 seconds, not 24 hours. The implementation must search by block timestamp and fail as a warning when the archival provider cannot answer.
Blocks product: no

// A focused packaged probe for credential storage and main-process responsiveness, without external access.
async function runCredentialSmoke({ evaluate, stored, read, check, progress }) {
  progress('Credential fixture write started');
  try {
    await evaluate(`(()=>{
      window.__credentialProbe=new Promise(resolve=>setTimeout(()=>{
        window.workspace.saveKey({provider:'openai',key:'native-credential-probe-fixture'}).then(
          ()=>resolve({saved:true}),error=>resolve({error:error.message}));
      },50));
      return true;
    })()`);
    await evaluate('new Promise(resolve=>setTimeout(resolve,100))');
    const duringWrite = await evaluate('window.workspace.state()');
    check('Credential writes leave the main process responsive', Boolean(duringWrite.credentials));
    const result = await evaluate('window.__credentialProbe');
    if (result.error) throw new Error(result.error);
    progress('Credential fixture write resolved');
    const encrypted = stored();
    check('Packaged credential write persists encrypted data', Boolean(encrypted?.length));
    check(
      'Stored credential does not contain the fixture plaintext',
      !Buffer.from(encrypted).includes(Buffer.from('native-credential-probe-fixture')),
    );
    check(
      'Packaged credentials decrypt through the provider port',
      (await read()) === 'native-credential-probe-fixture',
    );
    const state = await evaluate('window.workspace.state()');
    check('Renderer state exposes credential availability only', state.credentials.openai === true);
  } finally {
    await evaluate("window.workspace.saveKey({provider:'openai',key:''})");
    check('Credential fixture is removed after the probe', !stored());
  }
}
module.exports = { runCredentialSmoke };

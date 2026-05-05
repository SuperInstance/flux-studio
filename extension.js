const vscode = require('vscode');

function activate(context) {
  const compile = vscode.commands.registerCommand('flux.compile', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const guard = editor.document.getText();
    try {
      const resp = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Compiling to FLUX-C..."
      }, async () => {
        const r = await fetch('http://localhost:5000/compile', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({guard})
        });
        return r.json();
      });
      const doc = await vscode.workspace.openTextDocument({
        content: `; FLUX-C Assembly\n; Compiled from .guard\n\n${resp.asm}\n\n; Bytecode ops: ${resp.ops}\n; Estimated cycles: ${resp.cycles_estimate}\n; Theorem: ${resp.theorem}`,
        language: 'asm'
      });
      vscode.window.showTextDocument(doc);
    } catch(e) {
      vscode.window.showErrorMessage('FLUX Compile Error: ' + e.message);
    }
  });

  const prove = vscode.commands.registerCommand('flux.prove', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const guard = editor.document.getText();
    try {
      const resp = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generating proof certificate..."
      }, async () => {
        const r = await fetch('http://localhost:5000/prove', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({guard})
        });
        return r.json();
      });
      vscode.window.showInformationMessage(
        `Proof certificate generated: ${resp.task_id.slice(0,8)}\nProver: ${resp.prover}\nTheorem: ${resp.theorem_status}`
      );
    } catch(e) {
      vscode.window.showErrorMessage('FLUX Prove Error: ' + e.message);
    }
  });

  context.subscriptions.push(compile, prove);
}
module.exports = { activate };

const vscode = require('vscode');

let statusBar;
const output = vscode.window.createOutputChannel('FLUX Studio');

function setStatus(text, icon = '') {
  if (statusBar) {
    statusBar.text = icon ? `${icon} ${text}` : text;
  }
}

function activate(context) {
  // Status bar item
  statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBar.text = 'FLUX: Ready';
  statusBar.command = 'flux.compile';
  statusBar.tooltip = 'Click to compile current .guard file';
  statusBar.show();
  output.appendLine('[FLUX] Extension activated');

  // Hover provider for .guard files
  const hoverProvider = vscode.languages.registerHoverProvider('guard', {
    provideHover(document, position) {
      const line = document.lineAt(position.line);
      const lineText = line.text;

      // Parse constraint line for type hints
      const constraintMatch = lineText.match(
        /^(\w+)\s+(in|>|>=|<|<=|when)\s+/
      );

      if (constraintMatch) {
        const varName = constraintMatch[1];
        const operator = constraintMatch[2];
        let typeHint = '';

        if (operator === 'in') {
          typeHint = `\`${varName}\` — range constraint (numeric)`;
        } else if (['>', '>=', '<', '<='].includes(operator)) {
          typeHint = `\`${varName}\` — threshold constraint (numeric)`;
        } else {
          typeHint = `\`${varName}\` — guard constraint`;
        }

        return new vscode.Hover({
          language: 'markdown',
          value: `**FLUX Constraint**\n\n${typeHint}\n\n---\n\n*Hover over constraints to inspect them. Press \`Ctrl+Shift+F5\` to compile.*`
        });
      }

      return new vscode.Hover({
        language: 'markdown',
        value: `**FLUX Guard File**\n\n*Use \`Ctrl+Shift+F5\` to compile this file.*`
      });
    }
  });

  const compile = vscode.commands.registerCommand('flux.compile', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    setStatus('FLUX: Compiling...', '$(sync~spin)');
    output.appendLine('[FLUX] Compiling...');

    const filePath = editor.document.uri.fsPath;
    const baseName = filePath.replace(/\.guard$/, '');
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

      const asmContent = `; FLUX-C Assembly
; Compiled from ${editor.document.fileName}
; Generated: ${new Date().toISOString()}

${resp.asm}

; Bytecode ops: ${resp.ops}
; Estimated cycles: ${resp.cycles_estimate}
; Theorem: ${resp.theorem}`;

      // Write to .flux-c file in same directory
      const fluxCPath = `${baseName}.flux-c`;
      const fluxCDoc = await vscode.workspace.openTextDocument({
        content: asmContent,
        language: 'asm'
      });
      await vscode.window.showTextDocument(fluxCDoc);
      await fluxCDoc.save();

      // Also open in current view
      const doc = await vscode.workspace.openTextDocument({
        content: asmContent,
        language: 'asm'
      });
      await vscode.window.showTextDocument(doc);

      setStatus('FLUX: Ready', '$(check)');
      output.appendLine(`[FLUX] Compiled successfully: ${fluxCPath}`);
      output.appendLine(`[FLUX] Bytecode ops: ${resp.ops}, Cycles: ${resp.cycles_estimate}`);
    } catch(e) {
      setStatus('FLUX: Error', '$(error)');
      output.appendLine(`[FLUX] Compile error: ${e.message}`);
      vscode.window.showErrorMessage('FLUX Compile Error: ' + e.message);
    }
  });

  const prove = vscode.commands.registerCommand('flux.prove', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    output.appendLine('[FLUX] Generating proof certificate...');

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

      output.appendLine(`[FLUX] Proof generated: ${resp.task_id}`);
      output.appendLine(`[FLUX] Prover: ${resp.prover}, Theorem: ${resp.theorem_status}`);

      vscode.window.showInformationMessage(
        `Proof certificate generated: ${resp.task_id.slice(0,8)}\nProver: ${resp.prover}\nTheorem: ${resp.theorem_status}`
      );
    } catch(e) {
      output.appendLine(`[FLUX] Prove error: ${e.message}`);
      vscode.window.showErrorMessage('FLUX Prove Error: ' + e.message);
    }
  });

  context.subscriptions.push(hoverProvider, compile, prove);
  output.appendLine('[FLUX] Commands registered: flux.compile, flux.prove');
}

module.exports = { activate };

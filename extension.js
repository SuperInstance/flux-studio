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
  output.appendLine('[FLUX] Extension activated v0.2.0');

  // Hover provider for .guard files
  const hoverProvider = vscode.languages.registerHoverProvider('guard', {
    provideHover(document, position) {
      const line = document.lineAt(position.line);
      const lineText = line.text;

      // Parse constraint line for type hints
      const constraintMatch = lineText.match(
        /^(\w+)\s+(in|>|>=|<|<=|when|with)\s+/
      );

      if (constraintMatch) {
        const varName = constraintMatch[1];
        const operator = constraintMatch[2];
        let typeHint = '';

        if (operator === 'in') {
          typeHint = `\`${varName}\` — range constraint (numeric)`;
        } else if (['>', '>=', '<', '<='].includes(operator)) {
          typeHint = `\`${varName}\` — threshold constraint (numeric)`;
        } else if (operator === 'when') {
          typeHint = `\`${varName}\` — conditional constraint`;
        } else if (operator === 'with') {
          typeHint = `\`${varName}\` — priority modifier`;
        } else {
          typeHint = `\`${varName}\` — guard constraint`;
        }

        return new vscode.Hover({
          language: 'markdown',
          value: `**FLUX Constraint**\n\n${typeHint}\n\n---\n\n*Press \`Ctrl+Shift+F5\` to compile.*`
        });
      }

      // Check for GUARD/REQUIRE/ASSERT keywords
      const keywordMatch = lineText.match(/\b(REQUIRE|ASSERT|GUARD|ENSURE)\b/);
      if (keywordMatch) {
        const kw = keywordMatch[1];
        let help = '';
        switch(kw) {
          case 'REQUIRE': help = '**REQUIRE** — Hard constraint. Compilation fails if unmet.'; break;
          case 'ASSERT': help = '**ASSERT** — Runtime check. Generates validation bytecode.'; break;
          case 'GUARD': help = '**GUARD** — Conditional constraint with WHEN/ELSE branches.'; break;
          case 'ENSURE': help = '**ENSURE** — Postcondition. Validated after execution.'; break;
        }
        return new vscode.Hover({
          language: 'markdown',
          value: `${help}\n\n---\n\n*Press \`Ctrl+Shift+F5\` to compile.*`
        });
      }

      return new vscode.Hover({
        language: 'markdown',
        value: `**FLUX Guard File**\n\n*Use \`Ctrl+Shift+F5\` to compile this file.*`
      });
    }
  });

  // Completion provider for GUARD keywords
  const completionProvider = vscode.languages.registerCompletionProvider('guard', {
    provideCompletionItems(document, position) {
      const line = document.lineAt(position.line);
      const lineText = line.text.substring(0, position.character);
      
      const items = [];
      
      // GUARD keywords
      const keywords = ['REQUIRE', 'ASSERT', 'GUARD', 'WHEN', 'ELSE', 'ENSURE', 'OTHERWISE', 'WITH', 'PROPERTY', 'IS', 'HIGH', 'MEDIUM', 'LOW', 'CRITICAL'];
      
      keywords.forEach(kw => {
        if (!lineText.includes(kw)) {
          items.push({
            label: kw,
            kind: vscode.CompletionItemKind.Keyword,
            insertText: kw,
            detail: `FLUX ${kw} keyword`
          });
        }
      });
      
      return items;
    }
  });

  const compile = vscode.commands.registerCommand('flux.compile', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const langId = editor.document.languageId;
    if (langId !== 'guard') {
      vscode.window.showWarningMessage('Open a .guard file first');
      return;
    }

    setStatus('FLUX: Compiling...', '$(sync~spin)');
    output.appendLine('[FLUX] Compiling...');

    const filePath = editor.document.uri.fsPath;
    const baseName = filePath.replace(/\.guard$/, '');
    const guard = editor.document.getText();

    try {
      // Check if backend is available
      try {
        const pingResp = await fetch('http://localhost:5000/', { method: 'GET' });
        if (!pingResp.ok) throw new Error('Backend not responding');
      } catch(e) {
        setStatus('FLUX: Offline', '$(warning)');
        output.appendLine('[FLUX] Backend not available at localhost:5000');
        vscode.window.showErrorMessage('FLUX Backend not running.\nStart flux-compiler server: cd /path/to/flux-compiler && python3 -m flask run');
        return;
      }

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

${resp.asm || 'NOP  ; No assembly output'}

; Bytecode ops: ${resp.ops || 0}
; Estimated cycles: ${resp.cycles_estimate || 'unknown'}
; Theorem: ${resp.theorem || 'unknown'}`;

      // Write to .flux-c file in same directory
      const fluxCPath = `${baseName}.flux-c`;
      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(fluxCPath),
        Buffer.from(asmContent, 'utf8')
      );

      // Open the compiled file
      const fluxCDoc = await vscode.workspace.openTextDocument(fluxCPath);
      await vscode.window.showTextDocument(fluxCDoc, { preview: true });

      setStatus('FLUX: Compiled', '$(check)');
      output.appendLine(`[FLUX] Compiled: ${fluxCPath}`);
      output.appendLine(`[FLUX] Bytecode ops: ${resp.ops || 0}, Cycles: ${resp.cycles_estimate || 'unknown'}`);
      
      vscode.window.showInformationMessage(`Compiled successfully!\n${resp.ops || 0} ops, ~${resp.cycles_estimate || '?'} cycles`);
    } catch(e) {
      setStatus('FLUX: Error', '$(error)');
      output.appendLine(`[FLUX] Compile error: ${e.message}`);
      vscode.window.showErrorMessage('FLUX Compile Error: ' + e.message);
    }
  });

  const prove = vscode.commands.registerCommand('flux.prove', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const langId = editor.document.languageId;
    if (langId !== 'guard') {
      vscode.window.showWarningMessage('Open a .guard file first');
      return;
    }

    output.appendLine('[FLUX] Generating proof certificate...');
    setStatus('FLUX: Proving...', '$(sync~spin)');

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

      output.appendLine(`[FLUX] Proof: ${resp.task_id}`);
      output.appendLine(`[FLUX] Prover: ${resp.prover}, Theorem: ${resp.theorem_status}`);
      setStatus('FLUX: Proved', '$(pass)');

      vscode.window.showInformationMessage(
        `Proof certificate generated\nProver: ${resp.prover}\nTheorem: ${resp.theorem_status}`
      );
    } catch(e) {
      setStatus('FLUX: Error', '$(error)');
      output.appendLine(`[FLUX] Prove error: ${e.message}`);
      vscode.window.showErrorMessage('FLUX Prove Error: ' + e.message);
    }
  });

  const validate = vscode.commands.registerCommand('flux.validate', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const langId = editor.document.languageId;
    if (langId !== 'guard') {
      vscode.window.showWarningMessage('Open a .guard file first');
      return;
    }

    setStatus('FLUX: Validating...', '$(sync~spin)');
    output.appendLine('[FLUX] Validating guard expressions...');

    const guard = editor.document.getText();
    try {
      const resp = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Validating guard expressions..."
      }, async () => {
        const r = await fetch('http://localhost:5000/certify', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({guard})
        });
        return r.json();
      });

      if (resp.valid) {
        setStatus('FLUX: Valid', '$(pass)');
        output.appendLine(`[FLUX] Validation passed: ${resp.message}`);
        vscode.window.showInformationMessage(`Validation passed: ${resp.message}`);
      } else {
        setStatus('FLUX: Invalid', '$(error)');
        output.appendLine(`[FLUX] Validation failed: ${resp.message}`);
        vscode.window.showWarningMessage(`Validation: ${resp.message}`);
      }
    } catch(e) {
      setStatus('FLUX: Error', '$(error)');
      output.appendLine(`[FLUX] Validation error: ${e.message}`);
      vscode.window.showErrorMessage('FLUX Validation Error: ' + e.message);
    }
  });

  context.subscriptions.push(hoverProvider, completionProvider, compile, prove, validate, statusBar);
  output.appendLine('[FLUX] Commands registered: flux.compile, flux.prove, flux.validate');
}

module.exports = { activate };
import sys, os, shutil
F = r"E:\学习\简历作品集\AI应用\Infinite-Canvas画布\用户版\无限画布\static\js\canvas.js"
if not os.path.isfile(F):
    print("ERR file missing"); sys.exit(2)
with open(F,"rb") as fh:
    raw=fh.read()
has_bom=raw.startswith(b"\xef\xbb\xbf")
text=raw.decode("utf-8-sig")
nl="\r\n" if "\r\n" in text else "\n"
A="let undoStack = [];"+nl+"const UNDO_MAX = 30;"
A2="let undoStack = [];"+nl+"let redoStack = [];"+nl+"const UNDO_MAX = 30;"
B=nl.join([
"function pushUndo(){",
"    if(!canvas) return;",
"    undoStack.push({nodes:JSON.parse(JSON.stringify(serializableCanvasNodes())), connections:JSON.parse(JSON.stringify(connections))});",
"    if(undoStack.length > UNDO_MAX) undoStack.shift();",
"}",
"function performUndo(){",
"    if(!canvas || !undoStack.length) return;",
"    const state = undoStack.pop();",
"    nodes = state.nodes;",
"    connections = state.connections;",
"    selected.clear();",
"    sanitizeConnections();",
"    syncGeneratorInputs();",
"    render();",
"    scheduleSave();",
"}"
])
B2=nl.join([
"function snapshotState(){",
"    return {nodes:JSON.parse(JSON.stringify(serializableCanvasNodes())), connections:JSON.parse(JSON.stringify(connections))};",
"}",
"function restoreState(state){",
"    nodes = state.nodes;",
"    connections = state.connections;",
"    selected.clear();",
"    sanitizeConnections();",
"    syncGeneratorInputs();",
"    render();",
"    scheduleSave();",
"}",
"function pushUndo(){",
"    if(!canvas) return;",
"    undoStack.push(snapshotState());",
"    redoStack = [];",
"    if(undoStack.length > UNDO_MAX) undoStack.shift();",
"}",
"function performUndo(){",
"    if(!canvas || !undoStack.length) return;",
"    redoStack.push(snapshotState());",
"    if(redoStack.length > UNDO_MAX) redoStack.shift();",
"    restoreState(undoStack.pop());",
"}",
"function performRedo(){",
"    if(!canvas || !redoStack.length) return;",
"    undoStack.push(snapshotState());",
"    if(undoStack.length > UNDO_MAX) undoStack.shift();",
"    restoreState(redoStack.pop());",
"}"
])
Q=chr(39)
C=nl.join([
"    if((e.ctrlKey || e.metaKey) && key === "+Q+"z"+Q+") {",
"        const tag = document.activeElement?.tagName;",
"        if(tag === "+Q+"INPUT"+Q+" || tag === "+Q+"TEXTAREA"+Q+" || document.activeElement?.isContentEditable) return;",
"        e.preventDefault(); performUndo();",
"    }"
])
C2=nl.join([
"    if((e.ctrlKey || e.metaKey) && key === "+Q+"z"+Q+") {",
"        const tag = document.activeElement?.tagName;",
"        if(tag === "+Q+"INPUT"+Q+" || tag === "+Q+"TEXTAREA"+Q+" || document.activeElement?.isContentEditable) return;",
"        e.preventDefault();",
"        if(e.shiftKey) performRedo(); else performUndo();",
"    }"
])
checks=[("A",A),("B",B),("C",C)]
ok=True
for nm,a in checks:
    c=text.count(a)
    print("ANCHOR %s count=%d"%(nm,c))
    if c!=1: ok=False
if not ok:
    print("ABORT anchor not unique"); sys.exit(1)
if "--apply" not in sys.argv:
    print("DRY-RUN ok, no write"); sys.exit(0)
bak=F+".bak_20261012-redo"
shutil.copyfile(F,bak)
text=text.replace(A,A2).replace(B,B2).replace(C,C2)
with open(F,"wb") as fh:
    if has_bom: fh.write(b"\xef\xbb\xbf")
    fh.write(text.encode("utf-8"))
print("BOM=%s NL=%s"%(has_bom,repr(nl)))
print("BACKUP="+bak)
print("APPLIED OK")
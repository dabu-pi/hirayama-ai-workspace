import ast

with open("server.py", encoding="utf-8") as f:
    src = f.read()

tree = ast.parse(src)

top_imports = []
for node in tree.body:
    if isinstance(node, ast.Import):
        for alias in node.names:
            top_imports.append(f"import {alias.name}")
    elif isinstance(node, ast.ImportFrom):
        names = ", ".join(a.name for a in node.names)
        top_imports.append(f"from {node.module} import {names}")

print("=== server.py top-level imports ===")
for i in top_imports:
    print(" ", i)

has_wa = any("write_application" in i for i in top_imports)
print()
print("write_application top-level:", "YES (NG)" if has_wa else "NO (OK)")

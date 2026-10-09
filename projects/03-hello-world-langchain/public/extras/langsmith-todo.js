/**
 * EXTRA: the "To do: show a LangSmith trace" card (planning notes, not part of the agent).
 * Adds the card from langsmith-todo.html under the diagram. Remove the EXTRA import in index.html to hide it.
 */
const box = document.createElement("div");
box.className = "todo-box";                     // style.css gives it its own row, under the diagram
document.body.append(box);
// Our own static file from this folder, so inserting it as HTML is safe.
fetch(new URL("./langsmith-todo.html", import.meta.url)).then((r) => r.text()).then((html) => { box.innerHTML = html; });

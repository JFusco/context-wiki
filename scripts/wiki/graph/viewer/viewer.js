"use strict";

(async function () {
  const colors = { index: "#805ad5", topic: "#2b6cb0", journal: "#2f855a", plan: "#c05621" };
  const response = await fetch("../data/graph.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`graph load failed: ${response.status}`);
  const data = await response.json();
  if (data.nodes.some((node) => !node.id.startsWith("wiki/"))) throw new Error("graph contains non-wiki nodes");
  const graph = new graphology.Graph({ multi: true });
  data.nodes.forEach((node) => graph.addNode(node.id, { ...node, color: colors[node.type] || "#718096" }));
  data.edges.forEach((edge) => graph.addEdgeWithKey(edge.id, edge.source, edge.target, { label: edge.relation, color: "#a0aec0", size: 1 }));
  const renderer = new Sigma(graph, document.getElementById("graph"));
  const search = document.getElementById("search");
  const checks = [...document.querySelectorAll("input[name=type]")];
  function refresh() {
    const query = search.value.trim().toLowerCase();
    const enabled = new Set(checks.filter((item) => item.checked).map((item) => item.value));
    renderer.setSetting("nodeReducer", (node, attrs) => ({ ...attrs, hidden: !enabled.has(attrs.type) || Boolean(query && !`${attrs.label} ${node}`.toLowerCase().includes(query)) }));
    renderer.refresh();
  }
  search.addEventListener("input", refresh);
  checks.forEach((item) => item.addEventListener("change", refresh));
  renderer.on("clickNode", ({ node }) => {
    const attrs = graph.getNodeAttributes(node);
    document.getElementById("details").textContent = `${attrs.label}\n${node}\nType: ${attrs.type}`;
  });
})();

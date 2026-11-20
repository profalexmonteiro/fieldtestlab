import { defineConfig } from "vite";

// Embute o JS e o CSS do build dentro do dist/index.html, para o jogo abrir com duplo clique (file://),
// sem servidor: navegadores bloqueiam <script type="module" src> em arquivos locais, mas não scripts embutidos.
function standaloneHtml() {
  return {
    name: "standalone-html",
    apply: "build",
    enforce: "post",
    generateBundle(_, bundle) {
      const html = Object.values(bundle).find((a) => a.fileName.endsWith(".html"));
      if (!html) return;
      let src = String(html.source).replace("<html lang=\"pt-BR\">", "<html lang=\"pt-BR\" data-standalone>");
      for (const a of Object.values(bundle)) {
        const name = a.fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (a.type === "chunk" && a.isEntry) {
          // "</body>", "</head>"… dentro do código (ex.: o relatório HTML) quebrariam a página: o navegador fecharia o
          // <script> e servidores como o Live Server injetam o script de recarga no primeiro "</body>" que acharem.
          // Em strings JS, "<\/" é igual a "</".
          const code = a.code.replace(/<\/(script|body|head|html|svg)/gi, "<\\/$1");
          src = src.replace(new RegExp(`<script type="module"[^>]*src="[^"]*${name}"[^>]*></script>`), () => `<script type="module">${code}</script>`);
          delete bundle[a.fileName];
        } else if (a.fileName.endsWith(".css")) {
          src = src.replace(new RegExp(`<link rel="stylesheet"[^>]*href="[^"]*${name}"[^>]*>`), () => `<style>${a.source}</style>`);
          delete bundle[a.fileName];
        }
      }
      html.source = src;
    }
  };
}

export default defineConfig({
  base: "./",
  // Os add-ons do three (examples/jsm) importam "three"; o jogo usa "three/webgpu", que já contém o núcleo.
  // O alias evita duas cópias do three no build.
  resolve: { alias: [{ find: /^three$/, replacement: "three/webgpu" }] },
  plugins: [standaloneHtml()],
  build: { target: "es2022", chunkSizeWarningLimit: 2000, assetsInlineLimit: 100000000 }
});

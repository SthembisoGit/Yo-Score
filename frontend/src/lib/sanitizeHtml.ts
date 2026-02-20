const ALLOWED_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'li',
  'ol',
  'p',
  'pre',
  'span',
  'strong',
  'ul',
]);

const ALLOWED_ATTRS = new Set(['href', 'target', 'rel']);

const sanitizeNode = (node: Node) => {
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();

  if (!ALLOWED_TAGS.has(tagName)) {
    const parent = element.parentNode;
    if (!parent) return;
    const textNode = document.createTextNode(element.textContent ?? '');
    parent.replaceChild(textNode, element);
    return;
  }

  const attributes = [...element.attributes];
  for (const attribute of attributes) {
    const name = attribute.name.toLowerCase();
    const value = attribute.value.trim();

    if (name.startsWith('on')) {
      element.removeAttribute(attribute.name);
      continue;
    }

    if (!ALLOWED_ATTRS.has(name)) {
      element.removeAttribute(attribute.name);
      continue;
    }

    if ((name === 'href' || name === 'src') && /^javascript:/i.test(value)) {
      element.setAttribute(attribute.name, '#');
    }
  }

  if (tagName === 'a') {
    if (!element.getAttribute('target')) {
      element.setAttribute('target', '_blank');
    }
    element.setAttribute('rel', 'noopener noreferrer');
  }
};

export const sanitizeHtml = (html: string): string => {
  if (!html) return '';

  const parser = new DOMParser();
  const documentRoot = parser.parseFromString(html, 'text/html');
  const walker = documentRoot.createTreeWalker(documentRoot.body, NodeFilter.SHOW_ELEMENT);
  const nodes: Node[] = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }
  for (const node of nodes) sanitizeNode(node);
  return documentRoot.body.innerHTML;
};


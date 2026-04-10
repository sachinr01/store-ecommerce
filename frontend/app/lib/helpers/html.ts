const BLOCK_TAG_BREAKS = /<\/(p|div|li|ul|ol|h1|h2|h3|h4|h5|h6|br|section|article)>/gi;
const LIST_BLOCK_PATTERN = /<(ul|ol)([^>]*)>([\s\S]*?)<\/\1>/gi;
const LIST_ITEM_PATTERN = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function basicSanitize(html: string): string {
  return decodeEntities(String(html || ''))
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(iframe|object|embed|form|meta|link)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(iframe|object|embed|form|meta|link)[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, ' $1="#"');
}

function isLikelySpecLabel(text: string): boolean {
  const value = text.trim();
  if (!value || value.length > 40) return false;
  if (/[.!?]$/.test(value)) return false;
  return /[a-z]/i.test(value);
}

function normalizeLabel(labelHtml: string): string {
  const plainLabel = labelHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!plainLabel) return '';
  return /[:.]$/.test(plainLabel) ? plainLabel : `${plainLabel}:`;
}

function normalizeSpecListsInString(html: string): string {
  return html.replace(LIST_BLOCK_PATTERN, (fullMatch, tagName, attrs, innerHtml) => {
    const items = Array.from(
      innerHtml.matchAll(LIST_ITEM_PATTERN) as Iterable<RegExpMatchArray>,
      (match) => match[1].trim()
    );

    if (items.length < 4 || items.length % 2 !== 0) {
      return fullMatch;
    }

    const labelCount = items.filter((item, index) => index % 2 === 0 && isLikelySpecLabel(item.replace(/<[^>]+>/g, ' '))).length;
    if (labelCount < items.length / 2) {
      return fullMatch;
    }

    const normalizedItems = [];
    for (let index = 0; index < items.length; index += 2) {
      const label = normalizeLabel(items[index]);
      const value = items[index + 1];
      if (!label || !value) {
        return fullMatch;
      }
      normalizedItems.push(
        `<li class="oc-spec-item"><strong class="oc-spec-label">${label}</strong><span class="oc-spec-value">${value}</span></li>`
      );
    }

    return `<${tagName}${attrs} class="oc-spec-list">${normalizedItems.join('')}</${tagName}>`;
  });
}

function normalizeSpecListsInDocument(root: ParentNode) {
  root.querySelectorAll('ul, ol').forEach((list) => {
    const items = [...list.children].filter((child): child is HTMLLIElement => child.tagName === 'LI');

    if (items.length < 4 || items.length % 2 !== 0) {
      return;
    }

    const labelCount = items.filter((item, index) => index % 2 === 0 && isLikelySpecLabel(item.textContent || '')).length;
    if (labelCount < items.length / 2) {
      return;
    }

    const fragments: HTMLLIElement[] = [];
    for (let index = 0; index < items.length; index += 2) {
      const labelText = normalizeLabel(items[index].innerHTML);
      const valueHtml = items[index + 1].innerHTML.trim();
      if (!labelText || !valueHtml) {
        return;
      }

      const li = document.createElement('li');
      const strong = document.createElement('strong');
      const value = document.createElement('span');
      li.className = 'oc-spec-item';
      strong.className = 'oc-spec-label';
      value.className = 'oc-spec-value';
      strong.textContent = labelText;
      li.appendChild(strong);
      value.insertAdjacentHTML('beforeend', valueHtml);
      li.appendChild(value);
      fragments.push(li);
    }

    list.classList.add('oc-spec-list');
    list.replaceChildren(...fragments);
  });
}

type SanitizeHtmlOptions = {
  normalizeSpecLists?: boolean;
};

export function sanitizeHtml(
  html: string | null | undefined,
  options: SanitizeHtmlOptions = {}
): string {
  const { normalizeSpecLists = true } = options;
  const input = normalizeSpecLists
    ? normalizeSpecListsInString(basicSanitize(String(html || '')))
    : basicSanitize(String(html || ''));

  if (typeof window === 'undefined') {
    return input;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(input, 'text/html');

  doc.querySelectorAll('script, style, iframe, object, embed, form, meta, link').forEach((node) => {
    node.remove();
  });

  doc.querySelectorAll('*').forEach((element) => {
    [...element.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();

      if (name.startsWith('on')) {
        element.removeAttribute(attr.name);
        return;
      }

      if ((name === 'href' || name === 'src') && value.startsWith('javascript:')) {
        element.removeAttribute(attr.name);
      }
    });
  });

  if (normalizeSpecLists) {
    normalizeSpecListsInDocument(doc);
  }

  return doc.body.innerHTML;
}

export function htmlToText(html: string | null | undefined): string {
  const sanitized = sanitizeHtml(html)
    .replace(BLOCK_TAG_BREAKS, '$&\n')
    .replace(/<[^>]+>/g, ' ');

  return sanitized.replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

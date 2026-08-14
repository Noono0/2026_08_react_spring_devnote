export type StructuredFormat = "JSON" | "YAML" | "XML";

const scalarFromText = (value: string): unknown => {
  const trimmed = value.trim();
  if (trimmed === "null" || trimmed === "~") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) return trimmed.slice(1, -1);
  return trimmed;
};

const yamlScalar = (value: unknown): string => {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
  return !text || /[:#\-{}[\],&*!|>'"%@`\n]|^(?:true|false|null|~|-?\d)/i.test(text) ? JSON.stringify(text) : text;
};

export const jsonValueToYaml = (value: unknown, indentation = 0): string => {
  const prefix = " ".repeat(indentation);
  if (Array.isArray(value)) {
    if (value.length === 0) return `${prefix}[]`;
    return value.map((item) => {
      if (item !== null && typeof item === "object") return `${prefix}-\n${jsonValueToYaml(item, indentation + 2)}`;
      return `${prefix}- ${yamlScalar(item)}`;
    }).join("\n");
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return `${prefix}{}`;
    return entries.map(([key, item]) => item !== null && typeof item === "object"
      ? `${prefix}${key}:\n${jsonValueToYaml(item, indentation + 2)}`
      : `${prefix}${key}: ${yamlScalar(item)}`).join("\n");
  }
  return `${prefix}${yamlScalar(value)}`;
};

interface YamlLine { indentation: number; content: string; lineNumber: number }

export const parseSimpleYaml = (source: string): unknown => {
  const lines: YamlLine[] = source.replace(/\t/g, "  ").split(/\r?\n/).map((line, index) => ({
    indentation: line.match(/^ */)?.[0].length ?? 0,
    content: line.trim(),
    lineNumber: index + 1,
  })).filter((line) => line.content && !line.content.startsWith("#"));
  if (lines.length === 0) throw new Error("YAML 입력이 비어 있습니다.");

  const parseBlock = (startIndex: number, indentation: number): { value: unknown; nextIndex: number } => {
    const isArray = lines[startIndex]?.content.startsWith("-") ?? false;
    const container: unknown[] | Record<string, unknown> = isArray ? [] : {};
    let lineIndex = startIndex;
    while (lineIndex < lines.length) {
      const line = lines[lineIndex];
      if (!line || line.indentation < indentation) break;
      if (line.indentation > indentation) throw new Error(`${line.lineNumber}번째 줄의 들여쓰기를 확인해 주세요.`);
      if (isArray) {
        if (!line.content.startsWith("-")) break;
        const itemText = line.content.slice(1).trim();
        if (!itemText) {
          const child = parseBlock(lineIndex + 1, lines[lineIndex + 1]?.indentation ?? indentation + 2);
          (container as unknown[]).push(child.value);
          lineIndex = child.nextIndex;
        } else if (/^[^:]+:\s*/.test(itemText)) {
          const separatorIndex = itemText.indexOf(":");
          const item: Record<string, unknown> = { [itemText.slice(0, separatorIndex).trim()]: scalarFromText(itemText.slice(separatorIndex + 1)) };
          (container as unknown[]).push(item);
          lineIndex += 1;
        } else {
          (container as unknown[]).push(scalarFromText(itemText));
          lineIndex += 1;
        }
      } else {
        const separatorIndex = line.content.indexOf(":");
        if (separatorIndex <= 0) throw new Error(`${line.lineNumber}번째 줄에 key: value 형식이 필요합니다.`);
        const key = line.content.slice(0, separatorIndex).trim();
        const valueText = line.content.slice(separatorIndex + 1).trim();
        if (!valueText && lines[lineIndex + 1] && (lines[lineIndex + 1]?.indentation ?? 0) > indentation) {
          const child = parseBlock(lineIndex + 1, lines[lineIndex + 1]?.indentation ?? indentation + 2);
          (container as Record<string, unknown>)[key] = child.value;
          lineIndex = child.nextIndex;
        } else {
          (container as Record<string, unknown>)[key] = valueText ? scalarFromText(valueText) : null;
          lineIndex += 1;
        }
      }
    }
    return { value: container, nextIndex: lineIndex };
  };
  return parseBlock(0, lines[0]?.indentation ?? 0).value;
};

const xmlElementToValue = (element: Element): unknown => {
  const children = Array.from(element.children);
  const attributes = Object.fromEntries(Array.from(element.attributes).map((attribute) => [`@${attribute.name}`, attribute.value]));
  if (children.length === 0) {
    const textValue = scalarFromText(element.textContent ?? "");
    return Object.keys(attributes).length > 0 ? { ...attributes, "#text": textValue } : textValue;
  }
  const result: Record<string, unknown> = { ...attributes };
  children.forEach((child) => {
    const childValue = xmlElementToValue(child);
    const existing = result[child.tagName];
    const existingValues: unknown[] = Array.isArray(existing) ? existing as unknown[] : [existing];
    result[child.tagName] = existing === undefined ? childValue : [...existingValues, childValue];
  });
  return result;
};

export const parseXml = (source: string): Record<string, unknown> => {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error("보안을 위해 DOCTYPE과 외부 Entity가 포함된 XML은 처리하지 않습니다.");
  const documentValue = new DOMParser().parseFromString(source, "application/xml");
  const parserError = documentValue.querySelector("parsererror");
  if (parserError) throw new Error(`XML 문법 오류: ${parserError.textContent?.split("\n")[0] ?? "태그 구조를 확인해 주세요."}`);
  const root = documentValue.documentElement;
  return { [root.tagName]: xmlElementToValue(root) };
};

const escapeXml = (value: unknown): string => String(value).replace(/[<>&'"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character] ?? character);
const safeXmlTag = (key: string): string => /^[A-Za-z_][\w.-]*$/.test(key) ? key : "item";

const valueToXml = (key: string, value: unknown, indentation: number): string => {
  const prefix = " ".repeat(indentation);
  const tag = safeXmlTag(key);
  if (Array.isArray(value)) return value.map((item) => valueToXml(tag, item, indentation)).join("\n");
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([entryKey]) => !entryKey.startsWith("@") && entryKey !== "#text");
    const attributes = Object.entries(value as Record<string, unknown>).filter(([entryKey]) => entryKey.startsWith("@")).map(([entryKey, entryValue]) => ` ${safeXmlTag(entryKey.slice(1))}="${escapeXml(entryValue)}"`).join("");
    const text = (value as Record<string, unknown>)["#text"];
    if (entries.length === 0) return `${prefix}<${tag}${attributes}>${text === undefined ? "" : escapeXml(text)}</${tag}>`;
    return `${prefix}<${tag}${attributes}>\n${entries.map(([childKey, childValue]) => valueToXml(childKey, childValue, indentation + 2)).join("\n")}\n${prefix}</${tag}>`;
  }
  return `${prefix}<${tag}>${value === null ? "" : escapeXml(value)}</${tag}>`;
};

export const jsonValueToXml = (value: unknown, rootName = "root"): string => `<?xml version="1.0" encoding="UTF-8"?>\n${valueToXml(rootName, value, 0)}`;

export const parseStructuredData = (format: StructuredFormat, source: string): unknown => {
  if (source.length > 2 * 1024 * 1024) throw new Error("입력은 2MB 이하로 줄여 주세요.");
  if (format === "JSON") return JSON.parse(source);
  if (format === "YAML") return parseSimpleYaml(source);
  return parseXml(source);
};

export const formatStructuredData = (format: StructuredFormat, value: unknown): string => {
  if (format === "JSON") return JSON.stringify(value, null, 2);
  if (format === "YAML") return jsonValueToYaml(value);
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 1) return `<?xml version="1.0" encoding="UTF-8"?>\n${valueToXml(entries[0]?.[0] ?? "root", entries[0]?.[1], 0)}`;
  }
  return jsonValueToXml(value);
};

const toTypeScriptType = (value: unknown, interfaceName: string, declarations: string[]): string => {
  if (value === null) return "null";
  if (Array.isArray(value)) return value.length === 0 ? "unknown[]" : `${toTypeScriptType(value[0], `${interfaceName}Item`, declarations)}[]`;
  if (typeof value === "object") {
    declarations.push(createTypeScriptInterface(value as Record<string, unknown>, interfaceName, declarations));
    return interfaceName;
  }
  return typeof value;
};

const createTypeScriptInterface = (value: Record<string, unknown>, name: string, declarations: string[]): string => {
  const fields = Object.entries(value).map(([key, fieldValue]) => `  ${JSON.stringify(key)}: ${toTypeScriptType(fieldValue, `${name}${key.charAt(0).toUpperCase()}${key.slice(1)}`, declarations)};`);
  return `export interface ${name} {\n${fields.join("\n")}\n}`;
};

export const generateTypeScriptInterfaces = (value: unknown, rootName = "RootDto"): string => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("TypeScript Interface 생성은 JSON 객체를 입력해 주세요.");
  const declarations: string[] = [];
  const root = createTypeScriptInterface(value as Record<string, unknown>, rootName, declarations);
  return [...declarations, root].reverse().join("\n\n");
};

const javaType = (value: unknown, name: string, records: string[]): string => {
  if (value === null) return "Object";
  if (Array.isArray(value)) return `List<${value.length === 0 ? "Object" : javaType(value[0], `${name}Item`, records)}>`;
  if (typeof value === "string") return "String";
  if (typeof value === "boolean") return "Boolean";
  if (typeof value === "number") return Number.isInteger(value) ? "Long" : "Double";
  records.push(createJavaRecord(value as Record<string, unknown>, name, records));
  return name;
};

const createJavaRecord = (value: Record<string, unknown>, name: string, records: string[]): string => {
  const fields = Object.entries(value).map(([key, fieldValue]) => `    ${javaType(fieldValue, `${name}${key.charAt(0).toUpperCase()}${key.slice(1)}`, records)} ${key.replace(/[^A-Za-z0-9_$]/g, "_")}`).join(",\n");
  return `public record ${name}(\n${fields}\n) {}`;
};

export const generateJavaRecords = (value: unknown, rootName = "RootDto"): string => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Java DTO 생성은 JSON 객체를 입력해 주세요.");
  const records: string[] = [];
  const root = createJavaRecord(value as Record<string, unknown>, rootName, records);
  return ["import java.util.List;", "", ...records, root].join("\n\n");
};

export const sortObjectKeys = (value: unknown): unknown => Array.isArray(value)
  ? value.map(sortObjectKeys)
  : value !== null && typeof value === "object"
    ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortObjectKeys(item)]))
    : value;

export interface JsonSchemaValidationResult {
  valid: boolean;
  errors: string[];
}

type JsonSchemaDraft = {
  type?: "object" | "array" | "string" | "number" | "integer" | "boolean" | "null";
  required?: string[];
  properties?: Record<string, JsonSchemaDraft>;
  items?: JsonSchemaDraft;
  enum?: unknown[];
};

const matchesSchemaType = (value: unknown, type: NonNullable<JsonSchemaDraft["type"]>): boolean => {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return typeof value === "number" && Number.isInteger(value);
  return typeof value === type;
};

export const validateJsonSchema = (value: unknown, schemaValue: unknown): JsonSchemaValidationResult => {
  if (schemaValue === null || typeof schemaValue !== "object" || Array.isArray(schemaValue)) throw new Error("JSON Schema는 객체여야 합니다.");
  const errors: string[] = [];
  const validate = (currentValue: unknown, schema: JsonSchemaDraft, path: string): void => {
    if (schema.enum && !schema.enum.some((item) => JSON.stringify(item) === JSON.stringify(currentValue))) errors.push(`${path}: enum 허용값에 포함되지 않습니다.`);
    if (schema.type && !matchesSchemaType(currentValue, schema.type)) {
      errors.push(`${path}: ${schema.type} 타입이어야 합니다.`);
      return;
    }
    if (currentValue !== null && typeof currentValue === "object" && !Array.isArray(currentValue)) {
      const objectValue = currentValue as Record<string, unknown>;
      schema.required?.forEach((key) => { if (!(key in objectValue)) errors.push(`${path}.${key}: 필수 속성이 없습니다.`); });
      Object.entries(schema.properties ?? {}).forEach(([key, propertySchema]) => { if (key in objectValue) validate(objectValue[key], propertySchema, `${path}.${key}`); });
    }
    if (Array.isArray(currentValue) && schema.items) currentValue.forEach((item, index) => validate(item, schema.items as JsonSchemaDraft, `${path}[${index}]`));
  };
  validate(value, schemaValue as JsonSchemaDraft, "$input");
  return { valid: errors.length === 0, errors };
};

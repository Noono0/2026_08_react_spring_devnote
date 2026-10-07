// dataConverter.ts — JSON·YAML·XML 서로 바꾸기, 정렬, 간단한 JSON Schema 검사, TypeScript interface·Java record 코드 생성
// 외부 라이브러리 없이 자주 쓰는 범위만 직접 구현했다(YAML은 들여쓰기 기반의 단순한 문법만 지원).

export type StructuredFormat = "JSON" | "YAML" | "XML";

// 글자 하나를 알맞은 값으로: "null"·"~" → null, "true" → true, 숫자 모양 → 숫자, 따옴표로 감싼 글 → 따옴표를 뗀 글
const scalarFromText = (value: string): unknown => {
  const trimmed = value.trim();
  if (trimmed === "null" || trimmed === "~") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) return trimmed.slice(1, -1);
  return trimmed;
};

// YAML로 쓸 때 특수문자가 있거나 true·숫자처럼 보이는 글은 따옴표로 감싸야 원래 글자로 다시 읽힌다.
const yamlScalar = (value: unknown): string => {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
  return !text || /[:#\-{}[\],&*!|>'"%@`\n]|^(?:true|false|null|~|-?\d)/i.test(text) ? JSON.stringify(text) : text;
};

// 값 → YAML 글. 객체·배열이면 들여쓰기를 2칸 늘려 자기 자신을 다시 부른다(재귀).
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

// YAML 글 → 값. 줄마다 들여쓰기 칸 수를 세고, 같은 들여쓰기의 줄들을 한 묶음(객체 또는 "-"로 시작하는 배열)으로 읽는다.
// 탭은 공백 2칸으로 바꾸고 주석(#)·빈 줄은 건너뛴다. 들여쓰기가 맞지 않으면 몇 번째 줄인지 알려 준다.
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

// XML 요소 → 값. 속성은 "@이름", 글자는 "#text"로 담고, 같은 이름의 자식 요소가 여러 개면 배열로 모은다.
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

// ★ DOCTYPE·ENTITY가 있으면 거부한다(XXE: 외부 엔티티로 다른 파일·주소를 끌어오는 공격 방지). 해석은 브라우저 DOMParser가 한다.
export const parseXml = (source: string): Record<string, unknown> => {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error("보안을 위해 DOCTYPE과 외부 Entity가 포함된 XML은 처리하지 않습니다.");
  const documentValue = new DOMParser().parseFromString(source, "application/xml");
  const parserError = documentValue.querySelector("parsererror");
  if (parserError) throw new Error(`XML 문법 오류: ${parserError.textContent?.split("\n")[0] ?? "태그 구조를 확인해 주세요."}`);
  const root = documentValue.documentElement;
  return { [root.tagName]: xmlElementToValue(root) };
};

// XML로 쓸 때: 특수문자(< > & ' ")는 엔티티로 바꾸고, 태그 이름으로 쓸 수 없는 키는 item으로 바꾼다.
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

// 화면에서 고른 형식으로 읽기/쓰기. 입력은 브라우저가 멈추지 않도록 2MB까지만 받는다.
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

// 샘플 JSON 값으로 TypeScript 타입을 추론한다. 중첩 객체는 이름을 붙인 interface를 따로 만들고, 배열은 첫 항목으로 타입을 정한다.
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

// 같은 방식으로 Java record를 만든다(정수 → Long, 소수 → Double, 배열 → List<…>).
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

// 객체 키를 가나다·알파벳 순으로 정렬(중첩까지). 두 JSON을 비교하기 쉽게 만든다.
export const sortObjectKeys = (value: unknown): unknown => Array.isArray(value)
  ? value.map(sortObjectKeys)
  : value !== null && typeof value === "object"
    ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortObjectKeys(item)]))
    : value;

export interface JsonSchemaValidationResult {
  valid: boolean;
  errors: string[];
}

// 지원하는 JSON Schema 키워드: type, required, properties, items, enum (그 밖의 키워드는 무시한다).
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

// 값을 스키마 규칙대로 끝까지 훑으며 틀린 곳을 경로($input.user.name 같은)와 함께 모두 모은다(첫 오류에서 멈추지 않는다).
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

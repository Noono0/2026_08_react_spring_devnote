export interface ConvertedCases { camel: string; pascal: string; snake: string; kebab: string; constant: string; }

const splitWords = (value: string): string[] => value.trim()
  .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
  .split(/[^a-zA-Z0-9가-힣]+/)
  .filter(Boolean);

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

export const convertCase = (value: string): ConvertedCases => {
  const parts = splitWords(value);
  return {
    camel: parts.map((part, index) => index === 0 ? part.toLowerCase() : capitalize(part)).join(""),
    pascal: parts.map(capitalize).join(""),
    snake: parts.map((part) => part.toLowerCase()).join("_"),
    kebab: parts.map((part) => part.toLowerCase()).join("-"),
    constant: parts.map((part) => part.toUpperCase()).join("_"),
  };
};

export type UUID = string;
export type DateTime = string; // ISO 8601
export type JSONDict = { [key: string]: JSONValue };
export type JSONValue =
	| string
	| number
	| boolean
	| null
	| JSONValue[]
	| { [key: string]: JSONValue };
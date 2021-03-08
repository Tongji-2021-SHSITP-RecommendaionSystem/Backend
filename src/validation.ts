import { Request, Response } from "express";

export type LengthConstraint = [number, number?];
export type NonTypeConstraint = boolean | RegExp | LengthConstraint;
export type Constraint = Function | NonTypeConstraint;
export type KeyConstraint<T extends Constraint> = [string, ...T[]];
class Restraint {
	type: Function = String
	nullable?: boolean
	length?: LengthConstraint
	pattern?: RegExp
	assign(pConstraint: Constraint): void {
		if (!pConstraint)
			return;
		if (typeof pConstraint == "boolean")
			this.nullable = pConstraint;
		else if (pConstraint instanceof RegExp)
			this.pattern = pConstraint;
		else if (pConstraint instanceof Function)
			this.type = pConstraint;
		else
			this.length = pConstraint;
	}
}
export enum FailureReason {
	Type = "wrong type",
	Omitted = "omitted",
	Pattern = "syntax not matching pattern",
	Long = "upper length limit exceeded",
	Short = "lower length limit exceeded",
	Redundant = "redundant"
}
export function satisfyConstraints(obj: object, ...constraints: KeyConstraint<Constraint>[]): true | [string, FailureReason] {
	const keys = Object.keys(obj);
	const constraintKeys = new Array<string>();
	for (const constraint of constraints) {
		constraintKeys.push(constraint[0]);
		const restraint: Restraint = new Restraint();
		restraint.assign(constraint[1]);
		restraint.assign(constraint[2]);
		restraint.assign(constraint[3]);
		restraint.assign(constraint[4]);
		if (keys.includes(constraint[0])) {
			if (obj[constraint[0]].constructor != restraint.type)
				return [constraint[0], FailureReason.Type];
			else if (restraint.pattern && !restraint.pattern.test(typeof obj[constraint[0]] == "string" ? obj[constraint[0]] : obj[constraint[0]].toString()))
				return [constraint[0], FailureReason.Pattern];
			else if (restraint.length) {
				if (typeof obj[constraint[0]] == "string") {
					if (obj[constraint[0]].length < restraint.length[0])
						return [constraint[0], FailureReason.Short];
					else if (restraint.length[1] && obj[constraint[0]].length > restraint.length[1])
						return [constraint[0], FailureReason.Long];
				}
				else {
					const str = obj[constraint[0]].toString();
					if (str.length < restraint.length[0])
						return [constraint[0], FailureReason.Short];
					else if (restraint.length[1] && str.length > restraint.length[1])
						return [constraint[0], FailureReason.Long];
				}
			}
		}
		else if (!restraint.nullable)
			return [constraint[0], FailureReason.Omitted];
	}
	for (const key of keys)
		if (!constraintKeys.includes(key))
			return [key, FailureReason.Redundant];
	return true;
}
export function validateParameter(request: Request, response: Response, ...constraints: KeyConstraint<NonTypeConstraint>[]): void {
	const result = satisfyConstraints(request.query, ...constraints);
	if (result !== true)
		response.status(400).send(`${result[0]} : ${result[1]}`);
}
export function validatePayload(request: Request, response: Response, ...constraints: KeyConstraint<Constraint>[]): void {
	const result = satisfyConstraints(request.body, ...constraints);
	if (result !== true)
		response.status(400).send(`${result[0]} : ${result[1]}`);
}
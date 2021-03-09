import { Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core"

export type LengthConstraint = [number, number?];
export type NonTypeConstraint = boolean | RegExp | LengthConstraint;
export type Constraint = Function | NonTypeConstraint;
export type KeyConstraint<KeySource extends Object, T extends Constraint = Constraint> = [Extract<keyof KeySource, string>, ...T[]];
class Restraint {
	type: Function = String
	nullable?: boolean
	length?: LengthConstraint
	pattern?: RegExp
	assign(constraint: Constraint): void {
		if (!constraint)
			return;
		if (typeof constraint == "boolean")
			this.nullable = constraint;
		else if (constraint instanceof RegExp)
			this.pattern = constraint;
		else if (constraint instanceof Function)
			this.type = constraint;
		else
			this.length = constraint;
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
export function satisfyConstraints<T extends Object>(target: T, ...constraints: KeyConstraint<T>[]): true | [string, FailureReason] {
	const keys = Object.keys(target);
	const constraintKeys = new Array<string>();
	for (const constraint of constraints) {
		let key: string = constraint[0];
		constraintKeys.push(key);
		const restraint: Restraint = new Restraint();
		restraint.assign(constraint[1]);
		restraint.assign(constraint[2]);
		restraint.assign(constraint[3]);
		restraint.assign(constraint[4]);
		if (keys.includes(constraint[0])) {
			if (target[key].constructor != restraint.type)
				return [key, FailureReason.Type];
			else if (restraint.pattern && !restraint.pattern.test(typeof target[key] == "string" ? target[key] : target[key].toString()))
				return [key, FailureReason.Pattern];
			else if (restraint.length) {
				if (typeof target[key] == "string") {
					if (target[key].length < restraint.length[0])
						return [key, FailureReason.Short];
					else if (restraint.length[1] && target[key].length > restraint.length[1])
						return [key, FailureReason.Long];
				}
				else {
					const str = target[key].toString();
					if (str.length < restraint.length[0])
						return [key, FailureReason.Short];
					else if (restraint.length[1] && str.length > restraint.length[1])
						return [key, FailureReason.Long];
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
export function validateParameter<ReqQuery>(request: Request<ParamsDictionary, any, any, ReqQuery>, response: Response, ...constraints: KeyConstraint<ReqQuery, NonTypeConstraint | typeof Array>[]): ReturnType<typeof satisfyConstraints> {
	const result = satisfyConstraints(request.query, ...constraints);
	if (result !== true)
		response.status(400).send(`${result[0]} : ${result[1]}`);
	return result;
}
export function validatePayload<ReqBody extends Record<string, any>>(request: Request<ParamsDictionary, any, ReqBody>, response: Response, ...constraints: KeyConstraint<ReqBody>[]): ReturnType<typeof satisfyConstraints> {
	const result = satisfyConstraints(request.body, ...constraints);
	if (result !== true)
		response.status(400).send(`${result[0]} : ${result[1]}`);
	return result;
}
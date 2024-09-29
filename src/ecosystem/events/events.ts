import { EventEmitter } from "node:events";

import type { EventsList } from "@cudenix/cudenix/events";

export interface Event<Events extends Record<keyof Events, unknown[]>>
	extends EventEmitter<Events> {}

export type AnyEvent = Event<any>;

type Constructor = new () => AnyEvent;

export const Event = function (this: AnyEvent) {
	const eventEmitter = new EventEmitter();

	return eventEmitter;
} as unknown as Constructor;

Event.prototype = Object.create(EventEmitter.prototype);
Event.prototype.constructor = Event;

export const event = <
	const Events extends Record<keyof Events, unknown[]> = EventsList,
>() => new Event() as Event<Events>;

export const events = event();

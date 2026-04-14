import { EventEmitter } from "node:events";

type Event<Events extends Record<keyof Events, unknown[]>> = EventEmitter<Events>;

type AnyEvent = Event<any>;

type Constructor = new () => AnyEvent;

export const Event = function  Event(this: AnyEvent) {
	return new EventEmitter();
} as unknown as Constructor;

export const event = <
	const Events extends Record<keyof Events, unknown[]> = Cudenix.Events.List,
>() => new Event() as Event<Events>;

export const events = event();

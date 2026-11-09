export const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

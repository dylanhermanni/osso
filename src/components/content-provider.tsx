"use client";
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type ReactElement,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  copyOverrides,
  translateCopy,
  type CopyRecord,
} from "@/lib/site-copy/core";
type ContentState = {
  records: CopyRecord[];
  canEdit: boolean;
  ready: boolean;
  text: (source: string) => string;
  replaceRecords: Dispatch<SetStateAction<CopyRecord[]>>;
};
const ContentContext = createContext<ContentState>({
  records: [],
  canEdit: false,
  ready: false,
  text: (source) => source,
  replaceRecords: () => {},
});
export function ContentProvider({
  records: initial,
  canEdit,
  ready,
  children,
}: {
  records: CopyRecord[];
  canEdit: boolean;
  ready: boolean;
  children: ReactNode;
}) {
  const [records, setRecords] = useState(initial);
  const [previousInitial, setPreviousInitial] = useState(initial);
  if (previousInitial !== initial) {
    setPreviousInitial(initial);
    setRecords(initial);
  }
  useEffect(() => {
    if (!ready) return;
    let active = true;
    async function refresh() {
      try {
        const response = await fetch("/api/site-copy", { cache: "no-store" });
        const result = await response.json();
        if (active && result.ready && Array.isArray(result.records))
          setRecords((previous) =>
            JSON.stringify(previous) === JSON.stringify(result.records)
              ? previous
              : result.records,
          );
      } catch {
        /* Keep the last published copy if the connection drops. */
      }
    }
    window.addEventListener("focus", refresh);
    const interval = window.setInterval(refresh, 30000);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      window.clearInterval(interval);
    };
  }, [ready]);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const overrides = copyOverrides(records);
    let active = true;
    navigator.serviceWorker.ready
      .then((registration) => {
        if (active)
          registration.active?.postMessage({
            type: "site-copy",
            offline: {
              title: translateCopy("Cheese the Rooster · offline", overrides),
              heading: translateCopy("Even offline.", overrides),
              description: translateCopy(
                "Maak verbinding met internet om je huisgegevens veilig te bekijken en te wijzigen.",
                overrides,
              ),
              retry: translateCopy("Opnieuw proberen", overrides),
            },
          });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [records]);
  const value = useMemo(() => {
    const overrides = copyOverrides(records);
    return {
      records,
      canEdit,
      ready,
      text: (source: string) => translateCopy(source, overrides),
      replaceRecords: setRecords,
    };
  }, [records, canEdit, ready]);
  return (
    <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
  );
}
export const useSiteContent = () => useContext(ContentContext);
function ContentText({ source }: { source: string }) {
  return useSiteContent().text(source);
}
const originalAttributes = new WeakMap<object, Record<string, string>>();
const originalOptions = new WeakMap<object, string>();
const attributes = [
  "title",
  "placeholder",
  "aria-label",
  "aria-description",
  "alt",
];
// Translate React text before rendering. Never mutate the DOM or replace user input,
// URLs, IDs, numeric values, status values, or HTML with text from the database.
export function CopyScope({ children }: { children: ReactNode }) {
  const { text } = useSiteContent();
  function visit(node: ReactNode): ReactNode {
    if (typeof node === "string") return <ContentText source={node} />;
    if (!isValidElement(node)) return node;
    if (node.type === ContentText || node.type === CopyScope) return node;
    const element = node as ReactElement<Record<string, unknown>>;
    if (
      typeof element.type === "string" &&
      ["script", "style", "code", "pre", "textarea"].includes(element.type)
    )
      return element;
    const props = element.props;
    if (element.type === "option") {
      const source =
        originalOptions.get(element) ??
        Children.toArray(props.children as ReactNode)
          .map((child) =>
            typeof child === "string" || typeof child === "number"
              ? String(child)
              : isValidElement<{ source?: string }>(child)
                ? child.props.source || ""
                : "",
          )
          .join("");
      const copy = cloneElement(element, {
        value: props.value ?? source,
        children: text(source),
      });
      originalOptions.set(copy, source);
      return copy;
    }
    const originals =
      originalAttributes.get(element) ||
      Object.fromEntries(
        attributes
          .filter(
            (name) =>
              typeof props[name] === "string" &&
              (name !== "title" || typeof element.type === "string"),
          )
          .map((name) => [name, props[name] as string]),
      );
    const updated: Record<string, unknown> = Object.fromEntries(
      Object.entries(originals).map(([name, source]) => [name, text(source)]),
    );
    if (props.children !== undefined)
      updated.children = Children.map(props.children as ReactNode, visit);
    const copy = cloneElement(element, updated);
    originalAttributes.set(copy, originals);
    return copy;
  }
  return Children.map(children, visit);
}

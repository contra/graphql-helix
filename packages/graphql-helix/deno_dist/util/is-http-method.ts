export const isHttpMethod = (
  target: "GET" | "POST",
  subject: string
): boolean => {
  return (
    subject.localeCompare(target, undefined, { sensitivity: "accent" }) === 0
  );
};

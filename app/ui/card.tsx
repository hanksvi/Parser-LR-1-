import * as React from "react";
export function Card(p: React.HTMLAttributes<HTMLDivElement>) { return <div {...p} className={"rounded-lg border bg-background text-foreground " + (p.className??"")} /> }
export function CardHeader(p: React.HTMLAttributes<HTMLDivElement>) { return <div {...p} className={"p-6 " + (p.className??"")} /> }
export function CardTitle(p: React.HTMLAttributes<HTMLHeadingElement>) { return <h3 {...p} className={"text-lg font-semibold tracking-tight " + (p.className??"")} /> }
export function CardDescription(p: React.HTMLAttributes<HTMLParagraphElement>) { return <p {...p} className={"text-sm text-muted-foreground " + (p.className??"")} /> }
export function CardContent(p: React.HTMLAttributes<HTMLDivElement>) { return <div {...p} className={"p-6 pt-0 " + (p.className??"")} /> }
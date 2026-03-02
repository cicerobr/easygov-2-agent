export function getRouteLabel(pathname: string): string {
    if (pathname === "/") return "Dashboard";
    if (pathname.startsWith("/automacoes")) return "Automações";
    if (pathname.startsWith("/inbox")) return "Editais encontrados";
    if (pathname.startsWith("/salvos")) return "Editais Salvos";
    if (pathname.startsWith("/disputas")) return "Disputas";
    if (pathname.startsWith("/analises")) return "Análise de Editais";
    if (pathname.startsWith("/notificacoes")) return "Notificações";
    return "EasyGov";
}

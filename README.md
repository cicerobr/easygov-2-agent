# EasyGov - Monitoramento Inteligente de Editais

O **EasyGov** é uma plataforma avançada para monitoramento, análise e gestão de editais de licitação pública brasileira, integrada diretamente com o **Portal Nacional de Contratações Públicas (PNCP)**.

O sistema utiliza Inteligência Artificial para processar documentos complexos, extrair itens detalhados e identificar pontos de atenção, permitindo que empresas participem de certames com muito mais agilidade e segurança.

## 🚀 Funcionalidades Principais

- **Automação de Buscas**: Crie filtros personalizados por UF, Modalidade e Palavras-chave. O sistema monitora o PNCP automaticamente em intervalos definidos.
- **Análise de Editais via IA**: Processamento de PDFs de editais usando GPT-4 para extrair:
    - Resumo do objeto.
    - Lista detalhada de itens (quantidades, valores, especificações, marcas de referência).
    - Requisitos de habilitação (Jurídica, Fiscal, Técnica, etc.).
    - Prazos de entrega e condições de pagamento.
    - Pontos de atenção e riscos identificados na cláusula.
- **Inbox e Notificações**: Receba os resultados encontrados pelas automações diretamente no sistema ou via e-mail.
- **Gestão de Favoritos**: Salve editais interessantes e mantenha todo o histórico de análises organizado.
- **Dashboard Interativo**: Acompanhe o progresso das análises e o volume de editais encontrados.

## 🛠️ Stack Tecnológica

### Backend
- **Python 3.13+**
- **FastAPI**: Framework web de alta performance.
- **SQLAlchemy**: ORM para manipulação de banco de dados.
- **OpenAI API**: Motor de inteligência artificial para análise de documentos.
- **PyMuPDF**: Extração e manipulação de texto de arquivos PDF.

### Frontend
- **Next.js 15+** (App Router)
- **TypeScript**
- **Tailwind CSS / Vanilla CSS**: UI premium com suporte a tema escuro/claro e micro-animações.
- **Lucide React**: Biblioteca de ícones.

## 📦 Como Iniciar

### Pré-requisitos
- Python instalado.
- Node.js instalado.
- Chave de API da OpenAI.

### Backend Setup
1. Navegue até a pasta `backend`.
2. Crie um ambiente virtual: `python -m venv venv`.
3. Ative o venv: `source venv/bin/activate`.
4. Instale as dependências: `pip install -r requirements.txt`.
5. Configure o arquivo `.env` baseado no `.env.example`.
6. Inicie o servidor: `python -m app.main`.

### Frontend Setup
1. Navegue até a pasta `frontend`.
2. Instale as dependências: `npm install`.
3. Inicie o ambiente de desenvolvimento: `npm run dev`.

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---
Desenvolvido para transformar a forma como empresas interagem com o setor público.

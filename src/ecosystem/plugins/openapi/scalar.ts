export const scalar = (title: string, spec: string, configuration: string) => {
	return `
        <!DOCTYPE html>
        <html>
            <head>
                <title>${Bun.escapeHTML(title)}</title>

                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </head>

            <body>
                <script id="api-reference" type="application/json">
                    ${Bun.escapeHTML(spec)}
                </script>

                <script>
                    document.getElementById("api-reference").dataset.configuration = '${Bun.escapeHTML(configuration)}';
                </script>

                <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
            </body>
        </html>
    `;
};

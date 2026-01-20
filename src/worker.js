export default {
  async fetch(request, env, ctx) {
    // Static assets are served automatically by the [assets] config
    // This handler only runs for requests not matched by static assets
    // Add custom worker logic here when needed
    return new Response('Not Found', { status: 404 });
  },
};

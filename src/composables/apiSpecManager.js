import {
  generateApiSpec as generateApiSpecApi,
  exportApiSpec as exportApiSpecApi,
  testApiEndpoints as testApiEndpointsApi
} from '../services/apiClient.js';

function pickTickets(tickets = [], limit = 5) {
  return tickets.slice(0, limit).map(ticket => ({
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    modules: ticket.modules || [],
    tags: ticket.tags || []
  }));
}

function pickModules(modules = [], limit = 5) {
  return modules.slice(0, limit).map(module => ({
    id: module.id,
    name: module.name,
    type: module.type,
    pathHints: module.pathHints || [],
    dependencies: module.dependencies || [],
    externalDependencies: module.externalDependencies || []
  }));
}

function pickFeatures(features = [], limit = 5) {
  return features.slice(0, limit).map(feature => ({
    id: feature.id,
    title: feature.title,
    description: feature.description,
    moduleId: feature.moduleId,
    status: feature.status,
    priority: feature.priority
  }));
}

export function buildApiSpecDraftFlow() {
  const modules = Array.isArray(this.modules) ? this.modules : [];
  const features = Array.isArray(this.features) ? this.features : [];
  const tickets = Array.isArray(this.tickets) ? this.tickets : [];

  const projectName = this.latestSpecMeta?.projectName
    || this.packageJson?.name
    || 'Opnix Project';

  const servers = [
    { url: 'http://localhost:7337', description: 'Local development' }
  ];

  const moduleSchema = {
    type: 'object',
    required: ['id', 'name'],
    properties: {
      id: { type: ['string', 'number'] },
      name: { type: 'string' },
      type: { type: 'string' },
      pathHints: { type: 'array', items: { type: 'string' } },
      dependencies: { type: 'array', items: { type: 'string' } },
      externalDependencies: { type: 'array', items: { type: 'string' } },
      health: { type: 'number' },
      coverage: { type: 'number' }
    }
  };

  const ticketSchema = {
    type: 'object',
    required: ['id', 'title', 'status', 'priority'],
    properties: {
      id: { type: ['string', 'number'] },
      title: { type: 'string' },
      description: { type: 'string' },
      status: { type: 'string', enum: ['reported', 'inProgress', 'finished'] },
      priority: { type: 'string', enum: ['low', 'medium', 'high'] },
      modules: { type: 'array', items: { type: 'string' } },
      tags: { type: 'array', items: { type: 'string' } }
    }
  };

  const featureSchema = {
    type: 'object',
    required: ['id', 'title', 'status'],
    properties: {
      id: { type: ['string', 'number'] },
      title: { type: 'string' },
      description: { type: 'string' },
      status: { type: 'string', enum: ['proposed', 'approved', 'inDevelopment', 'testing', 'deployed'] },
      moduleId: { type: ['string', 'number', 'null'] },
      priority: { type: 'string', enum: ['low', 'medium', 'high'] }
    }
  };

  const endpoints = [
    {
      method: 'GET',
      path: '/api/tickets',
      summary: 'List tickets',
      description: 'Returns the set of tickets recorded in data/tickets.json.'
    },
    {
      method: 'POST',
      path: '/api/tickets',
      summary: 'Create a ticket',
      description: 'Adds a new ticket and persists it to data/tickets.json.'
    },
    {
      method: 'GET',
      path: '/api/features',
      summary: 'List features',
      description: 'Fetches features tracked in data/features.json.'
    },
    {
      method: 'POST',
      path: '/api/features',
      summary: 'Create a feature',
      description: 'Creates a new feature proposal with optional acceptance criteria.'
    },
    {
      method: 'GET',
      path: '/api/modules/graph',
      summary: 'Return module graph',
      description: 'Returns the module graph combining detector output and manual links.'
    },
    {
      method: 'POST',
      path: '/api/modules/detect',
      summary: 'Trigger module detection',
      description: 'Runs the detector across the repository and returns module metadata.'
    }
  ];

  const paths = {
    '/api/tickets': {
      get: {
        tags: ['Tickets'],
        summary: 'List tickets',
        responses: {
          200: {
            description: 'Tickets found',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Ticket' } },
                examples: {
                  default: { value: pickTickets(tickets) }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Tickets'],
        summary: 'Create ticket',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Ticket' }
            }
          }
        },
        responses: {
          201: {
            description: 'Ticket created'
          }
        }
      }
    },
    '/api/features': {
      get: {
        tags: ['Features'],
        summary: 'List features',
        responses: {
          200: {
            description: 'Features found',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Feature' } },
                examples: {
                  default: { value: pickFeatures(features) }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Features'],
        summary: 'Create feature',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Feature' }
            }
          }
        },
        responses: {
          201: { description: 'Feature created' }
        }
      }
    },
    '/api/modules/graph': {
      get: {
        tags: ['Modules'],
        summary: 'Retrieve module graph',
        responses: {
          200: {
            description: 'Module graph generated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    modules: { type: 'array', items: { $ref: '#/components/schemas/Module' } },
                    edges: { type: 'array', items: { type: 'object' } }
                  }
                },
                examples: {
                  default: { value: { modules: pickModules(modules), edges: this.moduleEdges || [] } }
                }
              }
            }
          }
        }
      }
    },
    '/api/modules/detect': {
      post: {
        tags: ['Modules'],
        summary: 'Trigger module detection run',
        responses: {
          200: {
            description: 'Detection complete',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    modules: { type: 'array', items: { $ref: '#/components/schemas/Module' } },
                    edges: { type: 'array', items: { type: 'object' } }
                  }
                },
                examples: {
                  default: { value: { modules: pickModules(modules), edges: this.moduleEdges || [] } }
                }
              }
            }
          }
        }
      }
    }
  };

  const summary = {
    moduleCount: modules.length,
    featureCount: features.length,
    ticketCount: tickets.length
  };

  return {
    openapi: '3.1.0',
    info: {
      title: `${projectName} API`,
      version: '1.0.0',
      description: 'Draft OpenAPI specification generated from live Opnix data.'
    },
    servers,
    tags: [
      { name: 'Tickets', description: 'Ticket management endpoints' },
      { name: 'Features', description: 'Feature lifecycle endpoints' },
      { name: 'Modules', description: 'Module detection and graph endpoints' }
    ],
    paths,
    components: {
      schemas: {
        Module: moduleSchema,
        Ticket: ticketSchema,
        Feature: featureSchema
      }
    },
    'x-draft-endpoints': endpoints,
    'x-draft-summary': summary
  };
}

export async function generateApiSpecFlow() {
  this.apiSpecWarnings = [];
  const draft = buildApiSpecDraftFlow.call(this);
  this.apiSpecPayload = draft;
  this.apiSpecContent = JSON.stringify(draft, null, 2);
  this.addTask('API Generator', 'Compiling API surface', 'processing');

  try {
    const response = await generateApiSpecApi({ spec: draft, format: this.apiFormat });
    if (response?.spec) {
      this.apiSpecPayload = response.spec;
      this.apiSpecContent = response.preview || JSON.stringify(response.spec, null, 2);
    }
    this.apiSpecWarnings = Array.isArray(response?.warnings) ? response.warnings : [];
    this.addTask('API Generator', 'API spec generated', 'complete');
  } catch (error) {
    console.error('Generate API spec failed', error);
    this.apiSpecWarnings = [error.message || 'API spec generation failed'];
    this.addTask('API Generator', 'API spec generation failed', 'complete');
  }
}

export async function exportApiSpecFlow({ format } = {}) {
  const spec = this.apiSpecPayload || buildApiSpecDraftFlow.call(this);
  try {
    const payload = await exportApiSpecApi({ spec, format: format || this.apiFormat });
    if (payload?.success) {
      this.addTask('API Export', `Spec saved as ${payload.filename}`, 'complete');
      if (typeof this.fetchExports === 'function') {
        await this.fetchExports();
      }
    }
    if (Array.isArray(payload?.warnings)) {
      this.apiSpecWarnings = payload.warnings;
    }
  } catch (error) {
    console.error('Export API spec failed', error);
    this.apiSpecWarnings = [error.message || 'API spec export failed'];
    this.addTask('API Export', 'API spec export failed', 'complete');
  }
}

export async function testApiSpecFlow({ format } = {}) {
  try {
    const payload = await testApiEndpointsApi({ spec: this.apiSpecPayload, format: format || this.apiFormat });
    const results = Array.isArray(payload?.results) ? payload.results : [];
    if (results.length) {
      const table = results.reduce((acc, item) => {
        acc[item.check] = `${item.status}: ${item.detail}`;
        return acc;
      }, {});
      console.table(table);
    }
    this.apiSpecWarnings = Array.isArray(payload?.warnings) ? payload.warnings : [];
    this.addTask('API Tester', payload?.success ? 'API checks passed' : 'API checks reported warnings', 'complete');
  } catch (error) {
    console.error('API spec tests failed', error);
    this.apiSpecWarnings = [error.message || 'API tests failed'];
    this.addTask('API Tester', 'API tests failed', 'complete');
  }
}

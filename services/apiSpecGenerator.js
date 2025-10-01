const path = require('path');
const fs = require('fs').promises;

function normaliseFormat(format) {
    const value = typeof format === 'string' ? format.toLowerCase() : '';
    if (value === 'custom' || value === 'json') {
        return value;
    }
    return 'openapi';
}

function slugify(value) {
    if (!value) return '';
    return String(value)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function buildComponents(context) {
    const modules = Array.isArray(context?.modules) ? context.modules : [];
    const features = Array.isArray(context?.features) ? context.features : [];
    const tickets = Array.isArray(context?.tickets) ? context.tickets : [];

    return {
        Module: {
            type: 'object',
            description: 'Code module discovered in the repository',
            properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                path: { type: 'string', nullable: true },
                type: { type: 'string', nullable: true },
                health: { type: 'number', nullable: true },
                coverage: { type: 'number', nullable: true },
                dependencies: {
                    type: 'array',
                    items: { type: 'string' },
                    default: []
                },
                externalDependencies: {
                    type: 'array',
                    items: { type: 'string' },
                    default: []
                },
                pathHints: {
                    type: 'array',
                    items: { type: 'string' },
                    default: []
                }
            },
            example: modules[0] || {
                id: 'app-core',
                name: 'App Core',
                type: 'custom'
            }
        },
        Feature: {
            type: 'object',
            description: 'Product or engineering feature tracked by Opnix',
            properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                status: { type: 'string' },
                moduleId: { type: 'string', nullable: true },
                priority: { type: 'string', nullable: true },
                acceptanceCriteria: {
                    type: 'array',
                    items: { type: 'string' },
                    default: []
                }
            },
            example: features[0] || {
                id: 'feat-1',
                title: 'New Feature',
                status: 'proposed'
            }
        },
        Ticket: {
            type: 'object',
            description: 'Issue or bug tracked in the Opnix ticket system',
            properties: {
                id: { type: 'integer' },
                title: { type: 'string' },
                description: { type: 'string' },
                priority: { type: 'string' },
                status: { type: 'string' },
                tags: {
                    type: 'array',
                    items: { type: 'string' },
                    default: []
                },
                modules: {
                    type: 'array',
                    items: { type: 'string' },
                    default: []
                }
            },
            example: tickets[0] || {
                id: 101,
                title: 'Investigate API health warnings',
                status: 'reported'
            }
        }
    };
}

function buildPathsFromContext(context) {
    const paths = {};
    const modules = Array.isArray(context?.modules) ? context.modules : [];
    const features = Array.isArray(context?.features) ? context.features : [];

    const ensurePath = pathKey => {
        if (!paths[pathKey]) {
            paths[pathKey] = {};
        }
        return paths[pathKey];
    };

    ensurePath('/health').get = {
        summary: 'Service health status',
        tags: ['Meta'],
        responses: {
            200: {
                description: 'Operational status and ticket metadata',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                status: { type: 'string' },
                                tickets: { type: 'integer' },
                                claudeReady: { type: 'boolean' }
                            }
                        }
                    }
                }
            }
        }
    };

    ensurePath('/tickets').get = {
        summary: 'List tickets',
        tags: ['Tickets'],
        responses: {
            200: {
                description: 'Ticket collection',
                content: {
                    'application/json': {
                        schema: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Ticket' }
                        }
                    }
                }
            }
        }
    };

    ensurePath('/tickets').post = {
        summary: 'Create ticket',
        tags: ['Tickets'],
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: { $ref: '#/components/schemas/Ticket' }
                }
            }
        },
        responses: {
            201: { description: 'Ticket created' }
        }
    };

    ensurePath('/tickets/{id}').get = {
        summary: 'Fetch ticket',
        tags: ['Tickets'],
        parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
            200: {
                description: 'Ticket payload',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Ticket' }
                    }
                }
            },
            404: { description: 'Ticket not found' }
        }
    };

    ensurePath('/tickets/{id}').put = {
        summary: 'Update ticket',
        tags: ['Tickets'],
        parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: { $ref: '#/components/schemas/Ticket' }
                }
            }
        },
        responses: {
            200: { description: 'Ticket updated' },
            400: { description: 'Invalid payload' },
            404: { description: 'Ticket not found' }
        }
    };

    ensurePath('/features').get = {
        summary: 'List features',
        tags: ['Features'],
        responses: {
            200: {
                description: 'Features collection',
                content: {
                    'application/json': {
                        schema: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Feature' }
                        }
                    }
                }
            }
        }
    };

    ensurePath('/features').post = {
        summary: 'Create feature',
        tags: ['Features'],
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
    };

    ensurePath('/modules').get = {
        summary: 'List modules',
        tags: ['Modules'],
        responses: {
            200: {
                description: 'Module collection',
                content: {
                    'application/json': {
                        schema: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Module' }
                        }
                    }
                }
            }
        }
    };

    ensurePath('/modules/detect').post = {
        summary: 'Trigger module detection',
        tags: ['Modules'],
        responses: {
            200: {
                description: 'Updated module inventory',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                modules: {
                                    type: 'array',
                                    items: { $ref: '#/components/schemas/Module' }
                                }
                            }
                        }
                    }
                }
            }
        }
    };

    ensurePath('/modules/{moduleId}').get = {
        summary: 'Inspect module',
        tags: ['Modules'],
        parameters: [
            { name: 'moduleId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
            200: {
                description: 'Module payload',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Module' }
                    }
                }
            },
            404: { description: 'Module not found' }
        }
    };

    modules.slice(0, 10).forEach(module => {
        const slug = slugify(module.id || module.name);
        if (!slug) return;
        const key = `/modules/${slug}/dependencies`;
        ensurePath(key).get = {
            summary: `Dependencies for ${module.name || slug}`,
            tags: ['Modules'],
            responses: {
                200: {
                    description: 'Module dependencies summary',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    dependencies: {
                                        type: 'array',
                                        items: { type: 'string' }
                                    },
                                    externalDependencies: {
                                        type: 'array',
                                        items: { type: 'string' }
                                    }
                                }
                            },
                            example: {
                                dependencies: module.dependencies || [],
                                externalDependencies: module.externalDependencies || []
                            }
                        }
                    }
                }
            }
        };
    });

    features.slice(0, 10).forEach(feature => {
        const slug = slugify(feature.id || feature.title);
        if (!slug) return;
        const key = `/features/${slug}/criteria`;
        ensurePath(key).get = {
            summary: `Acceptance criteria for ${feature.title || slug}`,
            tags: ['Features'],
            responses: {
                200: {
                    description: 'Acceptance criteria',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'array',
                                items: { type: 'string' }
                            },
                            example: feature.acceptanceCriteria || []
                        }
                    }
                }
            }
        };
    });

    return paths;
}

function buildDefaultSpec(context) {
    const warnings = [];
    const modules = Array.isArray(context?.modules) ? context.modules : [];
    const features = Array.isArray(context?.features) ? context.features : [];
    const tickets = Array.isArray(context?.tickets) ? context.tickets : [];
    const projectName = context?.project?.name || 'Opnix Service';
    const projectGoal = context?.project?.goal || 'Auto-generated API specification';

    if (!modules.length) {
        warnings.push('Module detection returned no modules; module endpoints will be limited.');
    }
    if (!features.length) {
        warnings.push('No features discovered; feature endpoints will be sparse.');
    }
    if (!tickets.length) {
        warnings.push('No tickets discovered; ticket endpoints will be limited.');
    }

    const spec = {
        openapi: '3.1.0',
        info: {
            title: `${projectName} API`,
            version: '1.0.0',
            description: projectGoal
        },
        servers: [
            { url: 'http://localhost:7337/api', description: 'Local development' }
        ],
        tags: [
            { name: 'Meta', description: 'Service metadata' },
            { name: 'Tickets', description: 'Incident and bug tracking' },
            { name: 'Modules', description: 'Code module inspection' },
            { name: 'Features', description: 'Product feature lifecycle' }
        ],
        paths: buildPathsFromContext(context),
        components: {
            schemas: buildComponents(context)
        },
        'x-opnix-summary': {
            modules: modules.length,
            features: features.length,
            tickets: tickets.length,
            generatedAt: new Date().toISOString()
        }
    };

    return { spec, warnings };
}

function summariseAsMarkdown(spec) {
    const lines = [];
    const info = spec.info || {};
    const paths = spec.paths || {};

    lines.push(`# ${info.title || 'Opnix API'}`);
    lines.push(`Version: ${info.version || '1.0.0'}`);
    if (info.description) {
        lines.push('');
        lines.push(info.description);
    }

    lines.push('\n## Endpoints');
    const pathEntries = Object.entries(paths);
    if (pathEntries.length === 0) {
        lines.push('- _No endpoints generated_');
    } else {
        pathEntries.forEach(([route, methods]) => {
            const methodEntries = Object.entries(methods || {});
            if (methodEntries.length === 0) {
                lines.push(`- **${route}**`);
                return;
            }
            methodEntries.forEach(([method, definition]) => {
                const summary = definition?.summary || `${method.toUpperCase()} ${route}`;
                lines.push(`- **${method.toUpperCase()} ${route}** — ${summary}`);
            });
        });
    }

    if (spec.components?.schemas) {
        lines.push('\n## Schemas');
        Object.keys(spec.components.schemas).forEach(schemaName => {
            lines.push(`- ${schemaName}`);
        });
    }

    return lines.join('\n');
}

function buildArtifact(spec, format) {
    const resolvedFormat = normaliseFormat(format);
    if (resolvedFormat === 'custom') {
        const markdown = summariseAsMarkdown(spec);
        return {
            format: 'markdown',
            extension: 'md',
            content: markdown,
            preview: markdown
        };
    }

    const json = JSON.stringify(spec, null, 2);
    return {
        format: 'json',
        extension: 'json',
        content: json,
        preview: json
    };
}

function generateApiSpec({ spec, format, context }) {
    let baseSpec = null;
    const warnings = [];

    if (spec && typeof spec === 'object' && Object.keys(spec).length > 0) {
        baseSpec = spec;
    } else {
        const generated = buildDefaultSpec(context || {});
        baseSpec = generated.spec;
        warnings.push(...generated.warnings);
    }

    const artifact = buildArtifact(baseSpec, format);
    return {
        spec: baseSpec,
        warnings,
        format: artifact.format,
        preview: artifact.preview,
        content: artifact.content,
        extension: artifact.extension
    };
}

async function generateApiSpecFile({ spec, format, context, exportsDir }) {
    const result = generateApiSpec({ spec, format, context });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `opnix-api-spec-${timestamp}.${result.extension}`;
    const filePath = path.join(exportsDir, filename);
    await fs.writeFile(filePath, result.content, 'utf8');
    return {
        filename,
        path: filePath,
        format: result.format,
        spec: result.spec,
        preview: result.preview,
        warnings: result.warnings
    };
}

module.exports = {
    generateApiSpec,
    generateApiSpecFile
};

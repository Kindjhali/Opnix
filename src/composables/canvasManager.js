import cytoscape from 'cytoscape';

import { refreshCanvasFlow, getHealthColorHelper } from './moduleManager.js';

export function ensureCanvasFlow() {
  const container = document.getElementById('canvas-container');
  if (!container) return;
  if (!this.cy) {
    this.cy = cytoscape({
      container,
      elements: [],
      boxSelectionEnabled: true,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': ele => getHealthColorHelper(ele.data('health') || 60),
            'label': 'data(label)',
            'color': '#FAEBD7',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'font-family': 'JetBrains Mono',
            'font-size': '12px',
            'width': '140px',
            'height': '90px',
            'border-width': 2,
            'border-color': '#06B6D4',
            'padding': '10px'
          }
        },
        {
          selector: 'edge',
          style: {
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'line-color': '#E94560',
            'target-arrow-color': '#E94560',
            'width': 2
          }
        },
        {
          selector: 'node:selected',
          style: {
            'background-color': '#FF8C3B',
            'border-color': '#E94560',
            'border-width': 4
          }
        }
      ],
      layout: {
        name: 'cose',
        animate: true,
        animationDuration: 800,
        nodeRepulsion: 4000,
        idealEdgeLength: 120
      },
      wheelSensitivity: 0.2
    });

    if (this.cy.edgehandles) {
      this.edgeHandles = this.cy.edgehandles({
        hoverDelay: 150,
        handleSize: 10,
        handleColor: '#FF8C3B',
        edgeType: () => 'flat',
        loopAllowed: () => false,
        edgeParams: () => ({ data: { type: 'dependency' } })
      });

      this.cy.on('ehcomplete', async (event, source, target, addedEdge) => {
        if (source.id() === target.id()) {
          addedEdge.remove();
          return;
        }
        await this.persistModuleLink(source.id(), target.id(), addedEdge);
      });
    }

    this.cy.on('tap', 'node', evt => {
      const node = evt.target;
      const module = this.modules.find(item => item.id === node.id());
      if (module) this.analyzeModule(module);
    });
  }

  refreshCanvasFlow.call(this);
}

export function layoutCanvasFlow(type) {
  if (!this.cy) return;
  const layouts = {
    breadthfirst: { name: 'breadthfirst', directed: true, padding: 10, spacingFactor: 1.3 },
    circle: { name: 'circle', radius: 280 },
    cose: { name: 'cose', nodeRepulsion: 4000, idealEdgeLength: 140 }
  };
  const config = layouts[type];
  if (config) {
    this.cy.layout(config).run();
  }
}

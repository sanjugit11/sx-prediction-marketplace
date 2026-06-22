import swaggerJSDoc from 'swagger-jsdoc';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SX Secure Prediction Marketplace API',
      version: '1.0.0',
      description: 'Production-ready backend API documentation for SX Secure Prediction Marketplace',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            walletAddress: { type: 'string' },
            deviceId: { type: 'string' },
            totpEnabled: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Market: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            contractAddress: { type: 'string' },
            question: { type: 'string' },
            creator: { type: 'string' },
            endTime: { type: 'string', format: 'date-time' },
            winner: { type: 'boolean', nullable: true },
            resolved: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Stake: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            positionId: { type: 'integer' },
            marketId: { type: 'string' },
            userId: { type: 'string' },
            outcome: { type: 'boolean' },
            amount: { type: 'string' },
            oddsAtEntry: { type: 'string' },
            claimed: { type: 'boolean' },
          },
        },
        MarketplaceListing: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            listingId: { type: 'integer' },
            stakeId: { type: 'string' },
            sellerId: { type: 'string' },
            buyerId: { type: 'string', nullable: true },
            price: { type: 'string' },
            status: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [], // We serve static definitions or manual spec for absolute correctness
};

export const swaggerSpec = swaggerJSDoc(options);

// Custom static additions to Swagger specs since we define manually
(swaggerSpec as any).paths = {
  '/api/auth/register': {
    post: {
      summary: 'Register a new wallet address',
      tags: ['Authentication'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['walletAddress', 'deviceId'],
              properties: {
                walletAddress: { type: 'string', example: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266' },
                deviceId: { type: 'string', example: 'android-1234' }
              }
            }
          }
        }
      },
      responses: {
        201: { description: 'User registered' }
      }
    }
  },
  '/api/auth/login': {
    post: {
      summary: 'Login with signed wallet message',
      tags: ['Authentication'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['walletAddress', 'signature', 'message'],
              properties: {
                walletAddress: { type: 'string', example: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266' },
                signature: { type: 'string' },
                message: { type: 'string', example: 'Sign this message to login to SX Prediction: 2026-06-21T13:40:00Z' },
                totpCode: { type: 'string', example: '123456' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Token and User details returned' }
      }
    }
  },
  '/api/auth/verify': {
    post: {
      summary: 'Verify and enable TOTP secondary layer',
      tags: ['Authentication'],
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['totpCode'],
              properties: {
                totpCode: { type: 'string', example: '123456' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'TOTP enabled' }
      }
    }
  },
  '/api/auth/profile': {
    get: {
      summary: 'Get authenticated user profile',
      tags: ['Authentication'],
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: 'User profile details' }
      }
    }
  },
  '/api/account/balance': {
    get: {
      summary: 'Get unified, committed, and uncommitted balances',
      tags: ['Account'],
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'token', in: 'query', schema: { type: 'string' } },
        { name: 'chainId', in: 'query', schema: { type: 'integer' } }
      ],
      responses: {
        200: { description: 'Balances object returned' }
      }
    }
  },
  '/api/account/deposit': {
    post: {
      summary: 'Generate deposit transaction payload',
      tags: ['Account'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount', 'committedPercentage'],
              properties: {
                token: { type: 'string' },
                amount: { type: 'string', example: '100000000' },
                committedPercentage: { type: 'integer', example: 50 }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'On-chain payload details' }
      }
    }
  },
  '/api/account/withdraw': {
    post: {
      summary: 'Generate withdrawal transaction payload',
      tags: ['Account'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['isCommitted'],
              properties: {
                token: { type: 'string' },
                amount: { type: 'string', example: '50000000' },
                isCommitted: { type: 'boolean' },
                subAccountId: { type: 'integer' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'On-chain payload details' }
      }
    }
  },
  '/api/markets': {
    get: {
      summary: 'Fetch all markets',
      tags: ['Markets'],
      parameters: [
        { name: 'resolved', in: 'query', schema: { type: 'boolean' } }
      ],
      responses: {
        200: { description: 'Array of markets' }
      }
    }
  },
  '/api/markets/{id}': {
    get: {
      summary: 'Fetch market details',
      tags: ['Markets'],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        { name: 'chainId', in: 'query', schema: { type: 'integer' } }
      ],
      responses: {
        200: { description: 'Market object' }
      }
    }
  },
  '/api/markets/create': {
    post: {
      summary: 'Generate market creation transaction payload',
      tags: ['Markets'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['question', 'endTime', 'minimumStake'],
              properties: {
                question: { type: 'string', example: 'Will ETH hit $5,000 by end of 2026?' },
                endTime: { type: 'integer', example: 1798761600 },
                minimumStake: { type: 'string', example: '10000000' },
                tokenAddress: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'On-chain payload details' }
      }
    }
  },
  '/api/markets/{id}/odds': {
    get: {
      summary: 'Fetch odds for YES and NO outcomes',
      tags: ['Markets'],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
      ],
      responses: {
        200: { description: 'Odds object' }
      }
    }
  },
  '/api/markets/{address}/stakes': {
    get: {
      summary: 'Fetch stakes placed in a market',
      tags: ['Markets'],
      parameters: [
        { name: 'address', in: 'path', required: true, schema: { type: 'string' } }
      ],
      responses: {
        200: { description: 'Array of stakes' }
      }
    }
  },
  '/api/markets/{id}/stake': {
    post: {
      summary: 'Generate staking transaction payload',
      tags: ['Staking'],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['outcome', 'amount'],
              properties: {
                outcome: { type: 'boolean', example: true },
                amount: { type: 'string', example: '100000000' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'On-chain payload details' }
      }
    }
  },
  '/api/users/{wallet}/positions': {
    get: {
      summary: 'Get staking positions for a wallet address',
      tags: ['Staking'],
      parameters: [
        { name: 'wallet', in: 'path', required: true, schema: { type: 'string' } }
      ],
      responses: {
        200: { description: 'Array of positions' }
      }
    }
  },
  '/api/markets/{id}/resolve': {
    post: {
      summary: 'Generate market resolution payload (Admin)',
      tags: ['Resolution'],
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['winner'],
              properties: {
                winner: { type: 'boolean', example: true }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'On-chain payload details' }
      }
    }
  },
  '/api/markets/{id}/claim': {
    post: {
      summary: 'Generate payout claim payload',
      tags: ['Resolution'],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['positionId'],
              properties: {
                positionId: { type: 'integer', example: 1 }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'On-chain payload details' }
      }
    }
  },
  '/api/leaderboard': {
    get: {
      summary: 'Get leaderboard accuracy rankings',
      tags: ['Leaderboard'],
      responses: {
        200: { description: 'Leaderboard list' }
      }
    }
  },
  '/api/leaderboard/distribute': {
    post: {
      summary: 'Distribute reward pool (Admin/Operator)',
      tags: ['Leaderboard'],
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['totalPool', 'topUsers'],
              properties: {
                token: { type: 'string' },
                totalPool: { type: 'string', example: '1000000000' },
                topUsers: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'On-chain payload details' }
      }
    }
  },
  '/api/leaderboard/claim': {
    post: {
      summary: 'Generate claim reward payload',
      tags: ['Leaderboard'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                token: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'On-chain payload details' }
      }
    }
  },
  '/api/listings': {
    get: {
      summary: 'Get active marketplace listings',
      tags: ['Marketplace'],
      parameters: [
        { name: 'status', in: 'query', schema: { type: 'string' } }
      ],
      responses: {
        200: { description: 'Array of listings' }
      }
    },
    post: {
      summary: 'Generate position listing payload',
      tags: ['Marketplace'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['marketAddress', 'positionId', 'price'],
              properties: {
                marketAddress: { type: 'string' },
                positionId: { type: 'integer' },
                price: { type: 'string', example: '50000000' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'On-chain payload details' }
      }
    }
  },
  '/api/listings/buy': {
    post: {
      summary: 'Generate listing purchase payload',
      tags: ['Marketplace'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['listingId'],
              properties: {
                listingId: { type: 'integer', example: 1 }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'On-chain payload details' }
      }
    }
  },
  '/api/listings/cancel': {
    post: {
      summary: 'Generate listing cancel payload',
      tags: ['Marketplace'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['listingId'],
              properties: {
                listingId: { type: 'integer', example: 1 }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'On-chain payload details' }
      }
    }
  },
  '/api/events': {
    get: {
      summary: 'Query indexed events',
      tags: ['Events'],
      parameters: [
        { name: 'eventName', in: 'query', schema: { type: 'string' } },
        { name: 'market', in: 'query', schema: { type: 'string' } },
        { name: 'wallet', in: 'query', schema: { type: 'string' } },
        { name: 'chainId', in: 'query', schema: { type: 'integer' } }
      ],
      responses: {
        200: { description: 'List of events' }
      }
    }
  },
  '/api/events/{chainId}/{txHash}': {
    get: {
      summary: 'Get event by txHash and chainId',
      tags: ['Events'],
      parameters: [
        { name: 'chainId', in: 'path', required: true, schema: { type: 'integer' } },
        { name: 'txHash', in: 'path', required: true, schema: { type: 'string' } }
      ],
      responses: {
        200: { description: 'Event details' }
      }
    }
  },
  '/api/stats': {
    get: {
      summary: 'Get platform aggregate statistics',
      tags: ['Stats'],
      responses: {
        200: { description: 'Aggregate statistics' }
      }
    }
  },
  '/api/health': {
    get: {
      summary: 'Get service health status',
      tags: ['Health'],
      responses: {
        200: { description: 'Health status' }
      }
    }
  },
  '/api/security/jailbreak-log': {
    post: {
      summary: 'Log jailbreak incident',
      tags: ['Security'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['payload', 'detectedType', 'severity'],
              properties: {
                walletAddress: { type: 'string' },
                payload: { type: 'string' },
                detectedType: { type: 'string' },
                severity: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        201: { description: 'Incident logged' }
      }
    }
  },
  '/api/security/logs': {
    get: {
      summary: 'Get logged security incidents',
      tags: ['Security'],
      parameters: [
        { name: 'severity', in: 'query', schema: { type: 'string' } }
      ],
      responses: {
        200: { description: 'Security logs list' }
      }
    }
  }
};

export default swaggerSpec;

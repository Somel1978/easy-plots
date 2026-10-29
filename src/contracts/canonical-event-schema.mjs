/** The proposed canonical Event v1 descriptor, pinned by compatibility tests. */
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const CANONICAL_EVENT_SCHEMA_V1=freeze({
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1
    },
    "kind": {
      "const": "event"
    },
    "schemaVersion": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$"
    },
    "revision": {
      "type": "integer",
      "minimum": 0
    },
    "partitionId": {
      "type": "string",
      "minLength": 1
    },
    "updatedAt": {
      "type": "string",
      "format": "date-time"
    },
    "accessClass": {
      "enum": [
        "gm-secret",
        "gm",
        "observer-private",
        "party",
        "published"
      ]
    },
    "provenance": {
      "type": "array",
      "items": {
        "type": "object"
      }
    },
    "eventType": {
      "type": "string",
      "minLength": 1
    },
    "eventVersion": {
      "type": "string",
      "minLength": 1
    },
    "worldId": {
      "type": "string",
      "minLength": 1
    },
    "origin": {
      "type": "object",
      "properties": {
        "kind": {
          "enum": [
            "foundry-hook",
            "gm-decision",
            "approved-intent",
            "scheduler",
            "reconciliation"
          ]
        },
        "sourceId": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "kind"
      ],
      "additionalProperties": false
    },
    "causalParentIds": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1
      }
    },
    "correlationId": {
      "type": "string",
      "minLength": 1
    },
    "originOperationId": {
      "type": "string",
      "minLength": 1
    },
    "involvedActorIds": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1
      }
    },
    "realTime": {
      "type": "string",
      "format": "date-time"
    },
    "worldTime": {
      "type": "number"
    },
    "payload": {
      "type": "object"
    },
    "payloadAccess": {
      "enum": [
        "gm-secret",
        "gm",
        "observer-private",
        "party",
        "published"
      ]
    }
  },
  "required": [
    "id",
    "kind",
    "schemaVersion",
    "revision",
    "partitionId",
    "updatedAt",
    "accessClass",
    "provenance",
    "eventType",
    "eventVersion",
    "worldId",
    "origin",
    "causalParentIds",
    "correlationId",
    "involvedActorIds",
    "realTime",
    "payload",
    "payloadAccess"
  ]
});

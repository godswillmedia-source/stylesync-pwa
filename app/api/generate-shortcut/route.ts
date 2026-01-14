import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('user');

  if (!userId) {
    return NextResponse.json(
      { error: 'Missing user ID parameter' },
      { status: 400 }
    );
  }

  // Generate personalized webhook URL
  const webhookURL = `${process.env.NEXT_PUBLIC_APP_URL}/api/sms-webhook/batch?user=${userId}`;

  // Create a JSON representation of the shortcut
  // iOS Shortcuts app can import this via "shortcuts://" URL scheme
  const shortcutConfig = {
    WFWorkflowName: "Sync StyleSeat Bookings",
    WFWorkflowDescription: "Syncs all StyleSeat booking SMS to your calendar",
    WFWorkflowIcon: {
      WFWorkflowIconStartColor: 4282601983,
      WFWorkflowIconGlyphNumber: 59511
    },
    WFWorkflowActions: [
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.filter.messages",
        WFWorkflowActionParameters: {
          WFContentItemFilter: {
            Value: {
              WFActionParameterFilterPrefix: 1,
              WFContentPredicateBoundedDate: false,
              WFActionParameterFilterTemplates: [
                {
                  Property: "Content",
                  Operator: 4,
                  Values: {
                    String: "StyleSeat:"
                  },
                  Removable: true
                }
              ]
            },
            WFSerializationType: "WFContentPredicateTableTemplate"
          },
          WFContentItemLimitEnabled: false,
          WFContentItemSortProperty: "Date",
          WFContentItemSortOrder: "Newest First"
        }
      },
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.gettext",
        WFWorkflowActionParameters: {
          WFTextActionText: {
            Value: {
              attachmentsByRange: {
                "{0, 1}": {
                  Type: "Variable",
                  VariableName: "Filtered Messages"
                }
              },
              string: "℘"
            },
            WFSerializationType: "WFTextTokenString"
          }
        }
      },
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.downloadurl",
        WFWorkflowActionParameters: {
          WFURL: webhookURL,
          WFHTTPMethod: "POST",
          WFHTTPBodyType: "JSON",
          WFJSONValues: {
            Value: {
              WFDictionaryFieldValueItems: [
                {
                  WFItemType: 0,
                  WFKey: {
                    Value: {
                      string: "messages",
                      attachmentsByRange: {}
                    },
                    WFSerializationType: "WFTextTokenString"
                  },
                  WFValue: {
                    Value: {
                      string: "℘",
                      attachmentsByRange: {
                        "{0, 1}": {
                          Type: "Variable",
                          VariableName: "Text"
                        }
                      }
                    },
                    WFSerializationType: "WFTextTokenString"
                  }
                }
              ]
            },
            WFSerializationType: "WFDictionaryFieldValue"
          }
        }
      },
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.getdictionaryvalue",
        WFWorkflowActionParameters: {
          WFDictionaryKey: "summary",
          WFInput: {
            Value: {
              OutputUUID: "previous-action-uuid",
              Type: "ActionOutput",
              OutputName: "Contents of URL"
            },
            WFSerializationType: "WFTextTokenAttachment"
          }
        }
      },
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.showalert",
        WFWorkflowActionParameters: {
          WFAlertActionTitle: "Sync Complete",
          WFAlertActionMessage: {
            Value: {
              string: "℘",
              attachmentsByRange: {
                "{0, 1}": {
                  Type: "Variable",
                  VariableName: "Dictionary Value"
                }
              }
            },
            WFSerializationType: "WFTextTokenString"
          }
        }
      }
    ],
    WFWorkflowClientVersion: "2302.0.5",
    WFWorkflowClientRelease: "2.2",
    WFWorkflowMinimumClientVersion: 900,
    WFWorkflowMinimumClientRelease: "2.0",
    WFWorkflowImportQuestions: [],
    WFWorkflowTypes: []
  };

  // For now, return JSON with instructions
  // TODO: Convert to proper binary plist format for .shortcut file
  return NextResponse.json({
    message: "Shortcut configuration generated",
    webhook_url: webhookURL,
    instructions: [
      "1. Create a new Shortcut in the Shortcuts app",
      "2. Add action: 'Find Messages'",
      "3. Set filter: Content contains 'StyleSeat:'",
      "4. Set date filter: Last 90 days",
      "5. Add action: 'Get text from' → select Messages",
      "6. Add action: 'Get Contents of URL'",
      `7. Set URL to: ${webhookURL}`,
      "8. Set Method to: POST",
      "9. Set Request Body to: JSON",
      "10. Add field: messages = (Text from previous step)",
      "11. Add action: 'Get Dictionary Value' → key: 'summary'",
      "12. Add action: 'Show Alert' → message: (Dictionary Value)",
      "13. Name shortcut: 'Sync StyleSeat Bookings'"
    ],
    shortcut_config: shortcutConfig,
    note: "Full .shortcut file generation coming soon. For now, follow manual instructions above."
  });
}

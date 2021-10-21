// init.spec.ts created with Cypress
//
// Start writing your Cypress tests below!
// If you're unfamiliar with how Cypress works,
// check out the link below and learn how to write your first test:
// https://on.cypress.io/writing-first-test

describe("Basic functionality", () => {
  it("can execute a simple operation", () => {
    const query = /* GraphQL */ `
      query {
        ping
      }
    `;
    cy.visit(`/graphql?query=${query}`);
    cy.get(".execute-button").click();
    return cy.window().then((w) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const value = w.g.resultComponent.viewer.getValue();
      expect(value).to.deep.equal(
        JSON.stringify(
          {
            data: {
              ping: true,
            },
          },
          null,
          2
        )
      );
    });
  });
  it("can execute a defer operation", () => {
    const query = /* GraphQL */ `
      query {
        song {
          firstVerse
          ... on Song @defer {
            secondVerse
          }
        }
      }
    `;
    cy.visit(`/graphql?query=${query}`);
    cy.get(".execute-button").click();
    cy.wait(6000);
    return cy.window().then((w) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const value = w.g.resultComponent.viewer.getValue();
      expect(value).to.deep.equal(
        JSON.stringify(
          {
            data: {
              song: {
                firstVerse: "Now I know my ABC's.",
                secondVerse: "Next time won't you sing with me?",
              },
            },
          },
          null,
          2
        )
      );
    });
  });
  it("can execute a subscription operation", () => {
    const subscription = /* GraphQL */ `
      subscription {
        count(to: 2)
      }
    `;
    cy.visit(`/graphql?query=${subscription}`);
    cy.get(".execute-button").click();
    cy.wait(5000);
    return cy.window().then((w) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const value = w.g.resultComponent.viewer.getValue();
      expect(value).to.deep.equal(
        JSON.stringify(
          {
            data: {
              count: 2,
            },
          },
          null,
          2
        )
      );
    });
  });
});

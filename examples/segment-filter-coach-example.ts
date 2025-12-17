/**
 * Example: Using the Segment Filter Coach
 *
 * This example demonstrates how to use the segment filter coach to generate
 * filter suggestions from natural language descriptions.
 */

import type { ChatClient, ChatMessage } from '../src/services/chatClient';
import { generateSegmentFiltersViaCoach } from '../src/services/icpCoach';
import type { FilterSuggestionRequest } from '../src/services/icpCoach';
import { validateFilters } from '../src/filters';

// Example chat client implementation (in production, use OpenAI, Anthropic, etc.)
class ExampleChatClient implements ChatClient {
  async complete(messages: ChatMessage[]): Promise<string> {
    // In a real implementation, this would call an LLM API
    console.log('System prompt:', messages[0].content.substring(0, 100) + '...');
    console.log('User message:', messages[1].content);

    // Mock response for demonstration
    return JSON.stringify({
      suggestions: [
        {
          filters: [
            { field: 'employees.role', operator: 'in', value: ['CTO', 'VP Engineering'] },
            { field: 'companies.employee_count', operator: 'gte', value: 100 },
          ],
          rationale: 'Targets senior technical decision makers in established companies',
          targetAudience: 'C-level and VP-level technology leaders in enterprise organizations',
        },
        {
          filters: [
            { field: 'employees.role', operator: 'eq', value: 'Head of Product' },
            { field: 'companies.industry', operator: 'eq', value: 'SaaS' },
            { field: 'companies.employee_count', operator: 'gte', value: 50 },
          ],
          rationale: 'Focuses on product leaders in growing SaaS companies',
          targetAudience: 'Product heads in mid-market to enterprise SaaS',
        },
        {
          filters: [
            { field: 'employees.department', operator: 'eq', value: 'Engineering' },
            { field: 'employees.seniority', operator: 'in', value: ['Director', 'VP', 'C-Level'] },
            { field: 'companies.employee_count', operator: 'lte', value: 500 },
          ],
          rationale: 'Targets senior engineering leadership in mid-sized organizations',
          targetAudience: 'Engineering directors and VPs in companies under 500 employees',
        },
      ],
    });
  }
}

async function example1_basicUsage() {
  console.log('\n=== Example 1: Basic Usage ===\n');

  const chatClient = new ExampleChatClient();

  const request: FilterSuggestionRequest = {
    userDescription: 'Target enterprise technology leaders',
  };

  const suggestions = await generateSegmentFiltersViaCoach(chatClient, request);

  console.log(`Generated ${suggestions.length} suggestions:\n`);

  suggestions.forEach((suggestion, idx) => {
    console.log(`Suggestion ${idx + 1}:`);
    console.log(`  Target Audience: ${suggestion.targetAudience}`);
    console.log(`  Rationale: ${suggestion.rationale}`);
    console.log(`  Filters:`);
    suggestion.filters.forEach((filter) => {
      console.log(`    - ${filter.field} ${filter.operator} ${JSON.stringify(filter.value)}`);
    });
    console.log();
  });
}

async function example2_withIcpContext() {
  console.log('\n=== Example 2: With ICP Context ===\n');

  const chatClient = new ExampleChatClient();

  const request: FilterSuggestionRequest = {
    userDescription: 'Find decision makers',
    icpContext: 'Mid-market FinTech companies (100-500 employees) in North America',
    maxSuggestions: 2,
  };

  const suggestions = await generateSegmentFiltersViaCoach(chatClient, request);

  console.log('ICP Context:', request.icpContext);
  console.log(`\nGenerated ${suggestions.length} suggestions (max: ${request.maxSuggestions}):\n`);

  suggestions.forEach((suggestion, idx) => {
    console.log(`Suggestion ${idx + 1}: ${suggestion.targetAudience}`);
    console.log(`  Filters: ${JSON.stringify(suggestion.filters, null, 2)}`);
    console.log();
  });
}

async function example3_validationIntegration() {
  console.log('\n=== Example 3: Integration with Filter Validation ===\n');

  const chatClient = new ExampleChatClient();

  const request: FilterSuggestionRequest = {
    userDescription: 'Target CTOs in SaaS',
    maxSuggestions: 1,
  };

  // Generate suggestions
  const suggestions = await generateSegmentFiltersViaCoach(chatClient, request);
  const selectedFilters = suggestions[0].filters;

  console.log('Generated filters:', JSON.stringify(selectedFilters, null, 2));

  // Validate using the standard filter validator
  const validation = validateFilters(selectedFilters);

  if (validation.ok) {
    console.log('\n✓ Filters are valid!');
    console.log('Validated filter clauses:');
    validation.filters.forEach((filter) => {
      console.log(`  - ${filter.field} ${filter.op} ${JSON.stringify(filter.value)}`);
    });
  } else {
    console.log('\n✗ Validation failed:', validation.error.message);
    console.log('Details:', validation.error.details);
  }
}

async function example4_multipleStrategies() {
  console.log('\n=== Example 4: Multiple Targeting Strategies ===\n');

  const chatClient = new ExampleChatClient();

  const request: FilterSuggestionRequest = {
    userDescription: 'Target growing SaaS companies',
    maxSuggestions: 3,
  };

  const suggestions = await generateSegmentFiltersViaCoach(chatClient, request);

  console.log('Generated 3 different targeting strategies:\n');

  suggestions.forEach((suggestion, idx) => {
    console.log(`Strategy ${idx + 1}: ${suggestion.rationale}`);
    console.log(`  Audience: ${suggestion.targetAudience}`);
    console.log(`  Filter count: ${suggestion.filters.length}`);

    // Count employee vs company filters
    const employeeFilters = suggestion.filters.filter((f) => f.field.startsWith('employees.'));
    const companyFilters = suggestion.filters.filter((f) => f.field.startsWith('companies.'));

    console.log(`  Employee filters: ${employeeFilters.length}`);
    console.log(`  Company filters: ${companyFilters.length}`);
    console.log();
  });
}

async function example5_errorHandling() {
  console.log('\n=== Example 5: Error Handling ===\n');

  // Mock client that returns invalid data
  class InvalidResponseClient implements ChatClient {
    async complete(_messages: ChatMessage[]): Promise<string> {
      return JSON.stringify({
        suggestions: [
          {
            filters: [
              // Invalid field prefix
              { field: 'invalid.field', operator: 'eq', value: 'test' },
            ],
          },
        ],
      });
    }
  }

  const chatClient = new InvalidResponseClient();

  const request: FilterSuggestionRequest = {
    userDescription: 'Test invalid response',
  };

  try {
    await generateSegmentFiltersViaCoach(chatClient, request);
    console.log('Should not reach here');
  } catch (error: any) {
    console.log('✓ Caught validation error:');
    console.log(`  Message: ${error.message}`);
    console.log('  This demonstrates the coach validates all generated filters');
  }
}

// Run all examples
async function main() {
  console.log('Segment Filter Coach Examples');
  console.log('============================');

  await example1_basicUsage();
  await example2_withIcpContext();
  await example3_validationIntegration();
  await example4_multipleStrategies();
  await example5_errorHandling();

  console.log('\n=== All Examples Complete ===\n');
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Error running examples:', error);
    process.exit(1);
  });
}

export { main as runExamples };

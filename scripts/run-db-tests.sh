#!/bin/bash

# =====================================================
# Database Test Runner
# =====================================================
# Purpose: Run pgTAP tests against Supabase database
# Usage: ./scripts/run-db-tests.sh [test_file]
#
# If test_file is provided, runs only that test.
# Otherwise, runs all tests in supabase/tests/

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Supabase is running locally
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}Error: Supabase CLI not found${NC}"
    echo "Please install: npm install -g supabase"
    exit 1
fi

# Check if project is linked
if [ ! -f .supabase/config.toml ]; then
    echo -e "${RED}Error: Supabase project not linked${NC}"
    echo "Please run: supabase init"
    exit 1
fi

# Get database connection string
DB_URL=$(supabase status --output json 2>/dev/null | jq -r '.DB_URL' || echo "")

if [ -z "$DB_URL" ]; then
    echo -e "${RED}Error: Could not get database URL${NC}"
    echo "Please ensure Supabase is running: supabase start"
    exit 1
fi

echo -e "${GREEN}Running database tests...${NC}\n"

# Determine which tests to run
if [ -n "$1" ]; then
    # Run specific test file
    TEST_FILES="supabase/tests/$1"
    if [ ! -f "$TEST_FILES" ]; then
        echo -e "${RED}Error: Test file not found: $TEST_FILES${NC}"
        exit 1
    fi
    echo -e "${YELLOW}Running test: $TEST_FILES${NC}"
else
    # Run all test files
    TEST_FILES=$(find supabase/tests -name "*.sql" | sort)
    echo -e "${YELLOW}Running all tests in supabase/tests/${NC}"
fi

# Counter for results
PASSED=0
FAILED=0
TOTAL=0

# Run each test file
for TEST_FILE in $TEST_FILES; do
    TOTAL=$((TOTAL + 1))
    TEST_NAME=$(basename "$TEST_FILE")
    
    echo -e "\n${YELLOW}▶ Testing: $TEST_NAME${NC}"
    
    # Run test and capture output
    if psql "$DB_URL" -f "$TEST_FILE" -v ON_ERROR_STOP=1 > /tmp/test_output.txt 2>&1; then
        # Check if test passed
        if grep -q "All tests successful" /tmp/test_output.txt || grep -q "ok" /tmp/test_output.txt; then
            echo -e "${GREEN}✓ PASSED${NC}"
            PASSED=$((PASSED + 1))
        else
            echo -e "${RED}✗ FAILED${NC}"
            cat /tmp/test_output.txt
            FAILED=$((FAILED + 1))
        fi
    else
        echo -e "${RED}✗ FAILED (error running test)${NC}"
        cat /tmp/test_output.txt
        FAILED=$((FAILED + 1))
    fi
done

# Print summary
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test Summary${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Total:  $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# Exit with error if any tests failed
if [ $FAILED -gt 0 ]; then
    exit 1
fi

echo -e "${GREEN}All tests passed! ✨${NC}"
exit 0

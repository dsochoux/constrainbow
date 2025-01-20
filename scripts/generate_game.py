import sqlite3
import random
import json

db_path = "database.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

symbols = ('@', '#', '$', '%')
alphabet = ('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's'
            't', 'u', 'v', 'w', 'x', 'y', 'z')
symbol_to_letter = {}

result = {
    "constraint_symbols" : list(symbols),
    "no_constraint_symbol": '-'
} # the result object that will be converted to JSON at the end
solutions_result = []

# between any two words, there MUST be a position that has differing symbols
# otherwise, there is the risk that the same word can be used multiple times

# there will always be a column where each word has a different symbol
# this will guarantee four symbols as well as guarantee no duplicate words
# (the front end won't even have to check! it will arise naturally from the constraints)

# this function will generate the constraints, which is the game
def generate_game():
    num_symbols = 0
    # I thought that this number would directly correlate to how hard the game is.
    # Turns out, randomness is wild. There can be millions of solutions, or zero,
    # without changing this number.
    desired_num_symbols = 10 # must be greater than 8
    words = [
        ['-', '-', '-', '-', '-'],
        ['-', '-', '-', '-', '-'],
        ['-', '-', '-', '-', '-'],
        ['-', '-', '-', '-', '-'],
    ]

    # first, randomly select a position to guarantee difference
    difference_column = random.randint(0, 4)
    for i in range(4):
        words[i][difference_column] = symbols[i]
        num_symbols += 1
    for i in range(4):
        # randomly pick a different word, and assign one of its
        # non-difference-positions this symbol. This guaretees that no
        # symbol is contained in only one word
        random_word = random.choice([j for j in range(0, 4) if j!=i])
        random_position = difference_column # start with a bad column
        while words[random_word][random_position] != '-':
            random_word = random.choice([j for j in range(0, 4) if j!=i])
            random_position = random.choice([j for j in range(0, 5) if j != difference_column])
        words[random_word][random_position] = symbols[i]
        num_symbols += 1
    
    # fill in the rest randomly
    while num_symbols != desired_num_symbols:
        random_word = random.choice([j for j in range(0, 4)])
        random_position = random.choice([j for j in range(0, 5)])
        if words[random_word][random_position] != '-': continue
        random_symbol = random.choice(symbols)
        words[random_word][random_position] = random_symbol
        num_symbols += 1

    return words

words = generate_game()

# result["constraints"] = {
#     "word_1": "".join(words[0]),
#     "word_2": "".join(words[1]),
#     "word_3": "".join(words[2]),
#     "word_4": "".join(words[3]),
# }
result["grid"] = words
result["constraints"] = {}
for i in range(len(words)):
    for j in range(len(words[i])):
        if words[i][j] == '-': continue
        l = result["constraints"].get(words[i][j], [])
        l.append([i, j])
        result["constraints"][words[i][j]] = l


num_valid_symbol_assignments = 0
num_possible_boards = 0

# takes in the start of a query, and a word (constraints)
def generate_query(query, word):
    query_args = []
    for i, symbol in enumerate(word):
        if symbol not in symbol_to_letter: continue
        query_args.append(symbol_to_letter[symbol])
        if i == 0:
            query += " first_letter = ?"
        elif i == 1:
            query += " second_letter = ?"
        elif i == 2:
            query += " third_letter = ?"
        elif i == 3:
            query += " fourth_letter = ?"
        else:
            query += " fifth_letter = ?"
        query += " AND"
    # chop off the last and
    if query[-4:] == " AND":
        query = query[:-4]
    query += ";"
    return query, query_args

# check to see if there are any solutions for the ith word in the words list
def is_solution_for(i):
    word = words[i]

    # construct the query
    query_stub = '''
    SELECT COUNT(*) FROM words
    WHERE
    '''
    query, query_args = generate_query(query_stub, word)
    cursor.execute(query, query_args)
    return cursor.fetchone()[0] > 0


# this function will be called every time a new symbol assignment is found that contains a solution/
def generate_solutions_for_assignment():
    # we would like to know how many possible different boards can emerge from a single
    # symbol mapping. to do this, we will multiply the number of possible solutions for each word
    # with each other. (how many ways can the first word be * how many ways can the second word be * ...)
    given_symbols_num_possibilities = 1 # start at 1 for multiplications sake
    solution_object = {
        "constraint_assignments": {**symbol_to_letter},
    }
    for i, word in enumerate(words):
        # construct the query
        query_stub = '''
        SELECT first_letter, second_letter, third_letter, fourth_letter, fifth_letter FROM words
        WHERE
        '''
        query, query_args = generate_query(query_stub, word)
        cursor.execute(query, query_args)
        raw_solutions = cursor.fetchall()
        solutions = [] # all of the different possible word choices
        for raw_solution in raw_solutions:
            solutions.append("".join(raw_solution))
        given_symbols_num_possibilities *= len(solutions)
        
        solution_object[f"word_{i + 1}"] = {
            "num_solutions": len(solutions),
            "solutions": solutions
        }
    solutions_result.append(solution_object)
    
    # we will want to add the computed number of possibilites for this symbol arrangement to a total 
    global num_possible_boards
    num_possible_boards += given_symbols_num_possibilities

def find_solution(symbol):
    if symbol == len(symbols):
        # we've found solutions! do something with them
        generate_solutions_for_assignment()
        global num_valid_symbol_assignments
        num_valid_symbol_assignments += 1
        return
    # symbol is an int pointing to the current symbol to be tried
    for letter in alphabet:
        # cannot re-use letters
        if letter in symbol_to_letter.values(): continue
        # assign <symbol> to that letter
        symbol_to_letter[symbols[symbol]] = letter
        # check if there are solutions for all words
        solutions_exist = True
        for i in range(len(words)):
            # we have not updated a constraint for this word, so there
            # is no reason to check if a valid one can be formed
            if symbols[symbol] not in words[i]: continue
            solutions_exist = solutions_exist and is_solution_for(i)
        # if there are, make a recursive call for the next symbol
        if solutions_exist:
            find_solution(symbol + 1)

        # otherwise, let the loop continue to the next letter
    # remove symbol from map before returning
    del symbol_to_letter[symbols[symbol]]


find_solution(0)
result["num_valid_constraint_assignments"] = num_valid_symbol_assignments
result["num_possible_solutions"] = num_possible_boards
result["solutions"] = solutions_result

output_file = f"generated_games/{num_valid_symbol_assignments}.{num_possible_boards}.{''.join([''.join(word) for word in words])}.json"
with open(output_file, "w") as f:
    json.dump(result, f, indent=4)

print(f"game file saved to {output_file}")
print(result['constraints'])

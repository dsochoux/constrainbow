import sqlite3
import random
import json
import time
import sys

db_path = "database.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

symbols = ('@', '#', '$', '%')
# symbols = ('@', '$')
alphabet = ('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's',
            't', 'u', 'v', 'w', 'x', 'y', 'z')
symbol_to_letter = {}
desired_num_symbols = 10 # must be greater than 8
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

    # ensure no row only has one symbol. Worst case, this adds 2 symbols
    # for i in range(4):
    #     # count num dashes
    #     num_symbols_in_word = 5 - words[i].count('-')
    #     if num_symbols_in_word == 1:
    #         # find a dash and replace it with a random symbol
    #         random_position = random.choice([j for j in range(0, 5) if words[i][j] == '-'])
    #         random_symbol = random.choice(symbols)
    #         words[i][random_position] = random_symbol
    #         num_symbols += 1
    
    # fill in the rest randomly
    while num_symbols < desired_num_symbols:
        random_word = random.choice([j for j in range(0, 4)])
        random_position = random.choice([j for j in range(0, 5)])
        if words[random_word][random_position] != '-': continue
        random_symbol = random.choice(symbols)
        words[random_word][random_position] = random_symbol
        num_symbols += 1

    return words

def generate_game_new(desired):
    words = [
        ['-', '-', '-', '-', '-'],
        ['-', '-', '-', '-', '-'],
        ['-', '-', '-', '-', '-'],
        ['-', '-', '-', '-', '-'],
    ]

    shuffled_symbols = list(symbols)
    random.shuffle(shuffled_symbols)
    guaranteed_symbols = [
        [shuffled_symbols[3], shuffled_symbols[0]], 
        [shuffled_symbols[0], shuffled_symbols[1]], 
        [shuffled_symbols[1], shuffled_symbols[2]], 
        [shuffled_symbols[2], shuffled_symbols[3]]
    ]
    for i in range(4):
        positions = random.sample(range(5), 2)
        words[i][positions[0]] = guaranteed_symbols[i][0]
        words[i][positions[1]] = guaranteed_symbols[i][1]
    total = 8
    # fill in the rest randomly
    _symbols = list(symbols)
    while total < desired:
        random_word = random.choice([j for j in range(0, 4)])
        random_position = random.choice([j for j in range(0, 5)])
        if words[random_word][random_position] != '-': continue
        random_symbol = random.choice(_symbols)
        _symbols.remove(random_symbol)
        words[random_word][random_position] = random_symbol
        total += 1
    return words

num_valid_symbol_assignments = 0
num_possible_boards = 0

# generate a query whose WHERE clause concerns only that the contrained letters
# match their constrained values 
def verify_constraints_query(query_stub, word):
    positive_index_to_clauses = [
        " first_letter = ?",
        " second_letter = ?",
        " third_letter = ?",
        " fourth_letter = ?",
        " fifth_letter = ?"
    ]
    query_args = []
    for i, symbol in enumerate(word):
        if symbol not in symbol_to_letter: continue
        query_args.append(symbol_to_letter[symbol])
        query_stub += positive_index_to_clauses[i]
        query_stub += " AND"
    # chop off the last and
    if query_stub[-4:] == " AND":
        query_stub = query_stub[:-4]
    query_stub += ";"
    return query_stub, query_args

# generate a query whose WHERE clause concerns that constrained letters match their
# constrained value AND where wildcard letters cannot be the same as a constrained
# letter
def verify_word_query(query_stub, word):
    positive_index_to_clauses = [
        " first_letter = ?",
        " second_letter = ?",
        " third_letter = ?",
        " fourth_letter = ?",
        " fifth_letter = ?"
    ]
    negative_index_to_clauses = [
        " first_letter != ?",
        " second_letter != ?",
        " third_letter != ?",
        " fourth_letter != ?",
        " fifth_letter != ?"
    ]

    query_args = []
    for i, symbol in enumerate(word):
        if symbol == '-':
            # we need to add clauses to ensure that the ith letter
            # is not a letter assigned to a constraint
            for letter in symbol_to_letter.values():
                query_args.append(letter)
                query_stub += negative_index_to_clauses[i]
                query_stub += " AND"
        else:
            # need to add clauses that ensure that the ith letter
            # is the letter assigned to the symbol
            query_args.append(symbol_to_letter[symbol])
            query_stub += positive_index_to_clauses[i]
            query_stub += " AND"
    if query_stub[-4:] == " AND":
        query_stub = query_stub[:-4]
    query_stub += ";"
    return query_stub, query_args

# check to see if there are any potential solutions for the ith word in the words list
def is_solution_for(i):
    word = words[i]

    # construct the query
    query_stub = '''
    SELECT COUNT(*) FROM words
    WHERE
    '''
    query, query_args = verify_constraints_query(query_stub, word)
    cursor.execute(query, query_args)
    return cursor.fetchone()[0] > 0

# this function will be called when we want to generate all solutions to a promising
# constraint assignment where the wildcards are not allowed to be the same letter
# as one of the constraints
def generate_solutions_wildcards_constrained():
    given_symbols_num_possibilities = 1
    solution_object = {
        "constraint_assignments": {**symbol_to_letter},
    }
    for i, word in enumerate(words):
        query_stub = '''
        SELECT first_letter, second_letter, third_letter, fourth_letter, fifth_letter FROM words
        WHERE
        '''
        query, query_args = verify_word_query(query_stub, word)
        cursor.execute(query, query_args)
        raw_solutions = cursor.fetchall()
        if len(raw_solutions) == 0:
            # there is no point in continuing, this constraint assignment has nothing for us
            return
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

# this function will be called when we want to generate all solutions to a promising
# constraint assignment where the wildcards can be anything
def generate_solutions_wildcards_free():
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
        query, query_args = verify_constraints_query(query_stub, word)
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
        # at this point, we have assigned each symbol a letter
        # this assignment is promisng -- there are words that would satisfy the 
        # constraints if the wildcard letters could by ANYTHING. However, I am messing
        # around with the idea that wildcards cannnot be the same letter as another symbol.
        # therefore, I must now check to make sure that for each word, there is a solution
        # where the wildcards are not the same as any of the symbols
        # generate_solutions_wildcards_free()
        generate_solutions_wildcards_constrained()
        global num_valid_symbol_assignments
        num_valid_symbol_assignments += 1
        return
    # symbol is an int pointing to the current symbol to be tried
    for letter in alphabet:
        # cannot re-use letters
        if letter in symbol_to_letter.values(): continue
        # assign letter to that symbol
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



def main(game_id):
    result = {
    "constraint_symbols" : list(symbols),
    "no_constraint_symbol": '-'
    } # the result object that will be converted to JSON at the end
    global words
    start = time.time()
    words = generate_game_new(10)
    # words = [
    #     ['-', '@', '-', '@', '-'],
    #     ['@', '-', '$', '-', '@'],
    #     ['-', '@', '-', '@', '-'],
    #     ['-', '-', '@', '-', '-'],
    # ]
    # words = generate_game()
    result["grid"] = words
    result["constraints"] = {}
    for i in range(len(words)):
        for j in range(len(words[i])):
            if words[i][j] == '-': continue
            l = result["constraints"].get(words[i][j], [])
            l.append([i, j])
            result["constraints"][words[i][j]] = l
    find_solution(0)
    end = time.time()
    # result["num_valid_constraint_assignments"] = num_valid_symbol_assignments
    if num_possible_boards == 0:
        return
    result["num_possible_solutions"] = num_possible_boards
    # result["solutions"] = solutions_result

    # TODO: when generating, automatically save the game to a file with the date (game id) as the name

    output_file = f"generated_games/{game_id}.json"
    # output_file = f"generated_games/solution.json"
    with open(output_file, "w") as f:
        json.dump(result, f, indent=4)

    print(f"game generated, solved, and saved to {output_file} in {end - start} seconds")
    print(result['constraints'])
    
    result["solutions"] = solutions_result
    output_file = f"generated_games_solutions/{game_id}.json"
    with open(output_file, "w") as f:
        json.dump(result, f, indent=4)

if __name__ == "__main__":
    # while num_possible_boards == 0:
    #     main(sys.argv[1])
    main(sys.argv[1])
    print(num_possible_boards)
    conn.close()

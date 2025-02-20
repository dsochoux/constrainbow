import sqlite3
import random
import json
import time
from datetime import datetime, timedelta

db_path = "database.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

constraints = [i + 1 for i in range(4)]
constraint_assignments = ['' for _ in range(len(constraints))]
word_length = 5
alphabet = ('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's',
            't', 'u', 'v', 'w', 'x', 'y', 'z')
symbol_to_letter = {}
solutions_result = []
best_solution = {
    "points": 0,
    "word_1": "",
    "word_2": "",
    "word_3": "",
    "word_4": ""
}

def generate_game_new(desired):
    words = [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
    ]

    shuffled_constraints = random.sample(constraints, 4)
    guaranteed_constraints = []
    for i in range(len(constraints)):
        guaranteed_constraints.append([shuffled_constraints[i], shuffled_constraints[(i + 1) % 4]])
    
    for i in range(len(words)):
        positions = random.sample(range(word_length), 2)
        words[i][positions[0]] = guaranteed_constraints[i][0]
        words[i][positions[1]] = guaranteed_constraints[i][1]
    total = 8
    # fill in the rest randomly
    _constraints = [i for i in range(1, len(constraints) + 1)]
    while total < desired:
        random_word = random.choice([i for i in range(0, len(words))])
        random_position = random.choice([i for i in range(0, word_length)])
        if words[random_word][random_position] != 0: continue
        random_constraint = random.choice(_constraints)
        _constraints.remove(random_constraint)
        words[random_word][random_position] = random_constraint
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
    for i, constraint in enumerate(word):
        if constraint == 0 or constraint_assignments[constraint - 1] == '': continue
        query_args.append(constraint_assignments[constraint - 1])
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
    for i, constraint in enumerate(word):
        if constraint == 0:
            # we need to add clauses to ensure that the ith letter
            # is not a letter assigned to a constraint
            for letter in constraint_assignments:
                query_args.append(letter)
                query_stub += negative_index_to_clauses[i]
                query_stub += " AND"
        else:
            # need to add clauses that ensure that the ith letter
            # is the letter assigned to the symbol
            query_args.append(constraint_assignments[constraint - 1])
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

def calculate_points_for(word):
    letter_to_points = {
        'a': 1,
        'b': 3,
        'c': 3,
        'd': 2,
        'e': 1,
        'f': 4,
        'g': 2,
        'h': 4,
        'i': 1,
        'j': 8,
        'k': 5,
        'l': 1,
        'm': 3,
        'n': 1,
        'o': 1,
        'p': 3,
        'q': 10,
        'r': 1,
        's': 1,
        't': 1,
        'u': 1,
        'v': 4,
        'w': 4,
        'x': 8,
        'y': 4,
        'z': 10
    }
    points = 0
    for letter in word:
        points += letter_to_points[letter]
    return points

# this function will be called when we want to generate all solutions to a promising
# constraint assignment where the wildcards are not allowed to be the same letter
# as one of the constraints
def generate_solutions_wildcards_constrained():
    given_symbols_num_possibilities = 1
    solution_object = {
        "constraint_assignments": [c for c in constraint_assignments],
        "best_total_points": 0
    }
    best_words = [None, None, None, None]
    best_points = [0, 0, 0, 0]
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
            points = calculate_points_for(raw_solution)
            if points > best_points[i]:
                best_points[i] = points
                best_words[i] = "".join(raw_solution)
        given_symbols_num_possibilities *= len(solutions)
        solution_object[f"word_{i + 1}"] = {
            "num_solutions": len(solutions),
            "best_word_option": best_words[i],
            "best_word_points": best_points[i],
            "solutions": solutions
        }
    best_total_points = sum(best_points)
    solution_object["best_total_points"] = best_total_points
    solutions_result.append(solution_object)
    if best_total_points > best_solution["points"]:
        best_solution["points"] = best_total_points
        best_solution["word_1"] = best_words[0]
        best_solution["word_2"] = best_words[1]
        best_solution["word_3"] = best_words[2]
        best_solution["word_4"] = best_words[3]
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

def find_solution(constraint):
    if constraint == len(constraints) + 1:
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
        if letter in constraint_assignments: continue
        # assign letter to that symbol
        constraint_assignments[constraint - 1] = letter
        # check if there are solutions for all words
        solutions_exist = True
        for i in range(len(words)):
            # we have not updated a constraint for this word, so there
            # is no reason to check if a valid one can be formed
            if constraint not in words[i]: continue
            solutions_exist = solutions_exist and is_solution_for(i)
        # if there are, make a recursive call for the next symbol
        if solutions_exist:
            find_solution(constraint + 1)

        # otherwise, let the loop continue to the next letter
    # remove symbol from map before returning
    constraint_assignments[constraint - 1] = ''



def main(game_id, num_colored, game_mode):
    result = {
    } # the result object that will be converted to JSON at the end
    global words
    start = time.time()
    
    words = generate_game_new(num_colored)
    result["grid"] = words
    result["constraints"] = [[] for _ in range(len(constraints) + 1)]
    for i in range(len(words)):
        for j in range(len(words[i])):
            result["constraints"][words[i][j]].append([i, j])
    find_solution(1)
    end = time.time()
    # result["num_valid_constraint_assignments"] = num_valid_symbol_assignments
    if num_possible_boards == 0:
        return
    result["num_possible_solutions"] = num_possible_boards
    result["num_possible_points"] = best_solution["points"]

    output_file = f"games/{game_mode}/{game_id}.json"
    # output_file = f"generated_games/solution.json"
    with open(output_file, "w") as f:
        json.dump(result, f, indent=4)

    print(f"game generated, solved, and saved to {output_file} in {end - start} seconds")
    
    result["best_solution"] = best_solution
    result["solutions"] = solutions_result
    output_file = f"game_solutions/{game_mode}/{game_id}.json"
    with open(output_file, "w") as f:
        json.dump(result, f, indent=4)

if __name__ == "__main__":
    start_date = datetime(2025, 2, 18)
    for i in range(11):
        date = start_date + timedelta(days=i)
        date_string = date.strftime("%m%d%Y")
        # generate speed game
        num_possible_boards = 0
        while num_possible_boards < 10000:
            num_possible_boards = 0
            main(date_string, 10, "speed")
        print(f"generated speed game for {date_string} with {num_possible_boards} solutions")
        # generate score game
        num_possible_boards = 0
        while num_possible_boards < 50000:
            num_possible_boards = 0
            main(date_string, 9, "score")
        print(f"generated score game for {date_string} with {num_possible_boards} solutions")

    conn.close()

import sqlite3
import random
import json
import time
from datetime import datetime, timedelta


class Game:
    db_path = "database.db"

    word_length = 5
    alphabet = ('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's',
            't', 'u', 'v', 'w', 'x', 'y', 'z')
    
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

    thresholds = {
        "speed": 15000,
        "score": 50000
    }

    def __init__(self, date, mode, num_colored):

        self.game_id = date.strftime("%m%d%Y")
        self.mode = mode
        self.num_colored = num_colored

        self.constraints = [i + 1 for i in range(4)]
        self.constraint_assignments = ['' for _ in range(len(self.constraints))]
        self.set_vars()

        self.conn = sqlite3.connect(self.db_path)
        self.cursor = self.conn.cursor()

    def __del__(self):
        self.conn.close()
        
    
    def set_vars(self):
        self.num_solutions = 0 # not the same as len(self.solutions)
        self.solutions = []
        self.best_solution = {
            "points": 0,
            "word_1": "",
            "word_2": "",
            "word_3": "",
            "word_4": ""
        }
        self.grid = [
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
        ]

    def generate_constraints(self):
        shuffled_constraints = random.sample(self.constraints, 4)
        guaranteed_constraints = []
        for i in range(len(self.constraints)):
            guaranteed_constraints.append([shuffled_constraints[i], shuffled_constraints[(i + 1) % 4]])
        
        for i in range(len(self.grid)):
            positions = random.sample(range(self.word_length), 2)
            self.grid[i][positions[0]] = guaranteed_constraints[i][0]
            self.grid[i][positions[1]] = guaranteed_constraints[i][1]
        total = 8
        # fill in the rest randomly
        _constraints = [i for i in range(1, len(self.constraints) + 1)]
        while total < self.num_colored:
            random_word = random.choice([i for i in range(0, len(self.grid))])
            random_position = random.choice([i for i in range(0, self.word_length)])
            if self.grid[random_word][random_position] != 0: continue
            random_constraint = random.choice(_constraints)
            _constraints.remove(random_constraint)
            self.grid[random_word][random_position] = random_constraint
            total += 1
    
    # generate a query whose WHERE clause concerns only that the contrained letters
    # match their constrained values
    def verify_constraints_query(self, query_stub, word):
        positive_index_to_clauses = [
            " first_letter = ?",
            " second_letter = ?",
            " third_letter = ?",
            " fourth_letter = ?",
            " fifth_letter = ?"
        ]
        query_args = []
        for i, constraint in enumerate(word):
            if constraint == 0 or self.constraint_assignments[constraint - 1] == '': continue
            query_args.append(self.constraint_assignments[constraint - 1])
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
    def verify_word_query(self, query_stub, word):
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
                for letter in self.constraint_assignments:
                    query_args.append(letter)
                    query_stub += negative_index_to_clauses[i]
                    query_stub += " AND"
            else:
                # need to add clauses that ensure that the ith letter
                # is the letter assigned to the symbol
                query_args.append(self.constraint_assignments[constraint - 1])
                query_stub += positive_index_to_clauses[i]
                query_stub += " AND"
        if query_stub[-4:] == " AND":
            query_stub = query_stub[:-4]
        query_stub += ";"
        return query_stub, query_args
    
    # check to see if there are any potential solutions for the ith word in the words list
    def is_solution_for(self, i):
        word = self.grid[i]
        # construct the query
        query_stub = '''
        SELECT COUNT(*) FROM words
        WHERE
        '''
        query, query_args = self.verify_constraints_query(query_stub, word)
        self.cursor.execute(query, query_args)
        return self.cursor.fetchone()[0] > 0
    
    @classmethod
    def calculate_points_for(cls, word):
        points = 0
        for letter in word:
            points += cls.letter_to_points[letter]
        return points
    
    # this function will be called when we want to generate all solutions to a promising
    # constraint assignment where the wildcards are not allowed to be the same letter
    # as one of the constraints
    def generate_solutions(self):
        num_solutions = 1 # base multiplication factor
        solution_object = {
            "constraint_assignments": [c for c in self.constraint_assignments],
            "best_total_points": 0
        }
        best_words = [None, None, None, None]
        best_points = [0, 0, 0, 0]
        for i, word in enumerate(self.grid):
            query_stub = '''
            SELECT first_letter, second_letter, third_letter, fourth_letter, fifth_letter FROM words
            WHERE
            '''
            query, query_args = self.verify_word_query(query_stub, word)
            self.cursor.execute(query, query_args)
            raw_solutions = self.cursor.fetchall()
            if len(raw_solutions) == 0:
                # there is no point in continuing, this constraint assignment has nothing for us
                return
            solutions = [] # all of the different possible word choices
            for raw_solution in raw_solutions:
                solutions.append("".join(raw_solution))
                points = self.calculate_points_for(raw_solution)
                if points > best_points[i]:
                    best_points[i] = points
                    best_words[i] = "".join(raw_solution)
            num_solutions *= len(solutions)
            solution_object[f"word_{i + 1}"] = {
                "num_solutions": len(solutions),
                "best_word_option": best_words[i],
                "best_word_points": best_points[i],
                "solutions": solutions
            }
        best_total_points = sum(best_points)
        solution_object["best_total_points"] = best_total_points
        self.solutions.append(solution_object)
        if best_total_points > self.best_solution["points"]:
            self.best_solution["points"] = best_total_points
            self.best_solution["word_1"] = best_words[0]
            self.best_solution["word_2"] = best_words[1]
            self.best_solution["word_3"] = best_words[2]
            self.best_solution["word_4"] = best_words[3]
        # we will want to add the computed number of possibilites for this symbol arrangement to a total 
        self.num_solutions += num_solutions

    def find_solution(self, constraint):
        if constraint == len(self.constraints) + 1:
            # at this point, we have assigned each symbol a letter
            # this assignment is promisng -- there are words that would satisfy the 
            # constraints if the wildcard letters could by ANYTHING. However, I am messing
            # around with the idea that wildcards cannnot be the same letter as another symbol.
            # therefore, I must now check to make sure that for each word, there is a solution
            # where the wildcards are not the same as any of the symbols
            self.generate_solutions()
            return
        # symbol is an int pointing to the current symbol to be tried
        for letter in self.alphabet:
            # cannot re-use letters
            if letter in self.constraint_assignments: continue
            # assign letter to that symbol
            self.constraint_assignments[constraint - 1] = letter
            # check if there are solutions for all words
            solutions_exist = True
            for i in range(len(self.grid)):
                # we have not updated a constraint for this word, so there
                # is no reason to check if a valid one can be formed
                if constraint not in self.grid[i]: continue
                solutions_exist = solutions_exist and self.is_solution_for(i)
            # if there are, make a recursive call for the next symbol
            if solutions_exist:
                self.find_solution(constraint + 1)

            # otherwise, let the loop continue to the next letter
        # remove symbol from map before returning
        self.constraint_assignments[constraint - 1] = ''
    
    def generate(self):
        while self.num_solutions < self.thresholds[self.mode]:
            self.set_vars()
            result = {
            } # the result object that will be converted to JSON at the end
            self.generate_constraints()
            result["grid"] = self.grid
            
            # writing constraints in useful format for the front end
            result["constraints"] = [[] for _ in range(len(self.constraints) + 1)]
            for i in range(len(self.grid)):
                for j in range(len(self.grid[i])):
                    result["constraints"][self.grid[i][j]].append([i, j])
            
            self.find_solution(1)
        
        result["num_possible_solutions"] = self.num_solutions
        result["num_possible_points"] = self.best_solution["points"]
        result["best_solution"] = self.best_solution

        output_file = f"games/{self.mode}/{self.game_id}.json"
        # output_file = f"generated_games/solution.json"
        with open(output_file, "w") as f:
            json.dump(result, f, indent=4)
        
        # result["solutions"] = self.solutions
        # output_file = f"game_solutions/{self.mode}/{self.game_id}.json"
        # with open(output_file, "w") as f:
        #     json.dump(result, f, indent=4)


if __name__ == "__main__":
    start_date = datetime(2025, 5, 1)
    end_date = datetime(2025, 5, 31)

    # loop through all the dates in the range
    for i in range((end_date - start_date).days + 1):
        date = start_date + timedelta(days=i)
        print(f"Generating games for {date.strftime('%m/%d/%Y')}")
        speed = Game(date, "speed", 10)
        speed.generate()
        score = Game(date, "score", 9)
        score.generate()

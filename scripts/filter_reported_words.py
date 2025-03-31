if __name__ == "__main__":
    with open("./word_files/words.txt", "r") as f:
        all_words = set(line.strip() for line in f)
    with open("./word_files/rejected_words.txt", "r") as f:
        rejected_words = set(line.strip() for line in f)
    with open("./word_files/reported_missing_words.txt", "r") as f:
        filtered_words = list(set([line.strip() for line in f if line.strip() not in all_words and line.strip() not in rejected_words]))
    with open ("./word_files/filtered_reported_missing_words.txt", "w") as f:
        f.write("\n".join(filtered_words) + "\n")
    
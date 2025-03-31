if __name__ == "__main__":
    with open("./word_files/words.txt", "r") as f:
        words = sorted([line.strip() for line in f if line.strip()])
    with open("./word_files/words.txt", "w") as f:
        f.write("\n".join(words) + "\n")
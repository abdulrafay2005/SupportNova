import joblib
import os
import pandas as pd
import matplotlib.pyplot as plt

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, classification_report, ConfusionMatrixDisplay



# 1. LOAD DATASET


dataset = pd.read_csv("ml/data/complaints.csv")

print("Dataset loaded")
print("Number of complaints:", len(dataset))



# 2. SELECT INPUT (X)


X = dataset["Complaint_Text"].fillna("")



# FUNCTION TO TRAIN A MODEL


def train_model(X, y, model_name):

    print("\n")
    print("=" * 50)
    print("TRAINING:", model_name)
    print("=" * 50)

    
    # 3. SPLIT DATASET
    

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=0,
        stratify=y
    )

    print("\nTraining complaints:", len(X_train))
    print("Testing complaints:", len(X_test))


    
    # 4. CREATE MODEL
    

    model = Pipeline([

        # Convert complaint text into numbers
        (
            "tfidf",
            TfidfVectorizer(
                lowercase=True,
                ngram_range=(1, 2)
            )
        ),

        # Classification algorithm
        (
            "classifier",
            LogisticRegression(
                max_iter=2000
            )
        )
    ])


    
    # 5. TRAIN MODEL
    

    print("\nTraining model...")

    model.fit(X_train, y_train)


    
    # 6. MAKE PREDICTIONS
    

    y_pred = model.predict(X_test)


    
    # 7. CALCULATE ACCURACY
    

    accuracy = accuracy_score(y_test, y_pred)

    print("\nAccuracy:", accuracy)
    print("Accuracy percentage:", round(accuracy * 100, 2), "%")


    
    # 8. CLASSIFICATION REPORT
    

    print("\nClassification Report:")

    print(
        classification_report(
            y_test,
            y_pred,
            zero_division=0
        )
    )


    
    # 9. CONFUSION MATRIX
    

    ConfusionMatrixDisplay.from_predictions(
    y_test,
    y_pred,
    xticks_rotation=45
)

    plt.title(model_name + " Classification")
    plt.tight_layout()

    filename = model_name.lower().replace(" ", "_") + "_confusion_matrix.png"

    plt.savefig("ml/reports/" + filename, dpi=150)

    plt.close()

    print("Confusion matrix saved to:", "ml/reports/" + filename)


    # Return the trained model
    return model



# 10. TRAIN CATEGORY MODEL


category_model = train_model(
    X,
    dataset["Category"],
    "Category Model"
)



# 11. TRAIN SUBCATEGORY MODEL


subcategory_model = train_model(
    X,
    dataset["Subcategory"],
    "Subcategory Model"
)



# 12. TRAIN DEPARTMENT MODEL


department_model = train_model(
    X,
    dataset["Assigned_Department"],
    "Department Model"
)


# 13. SAVE MODELS
os.makedirs("ml/models", exist_ok=True)

joblib.dump(category_model, "ml/models/category_model.pkl")
joblib.dump(subcategory_model, "ml/models/subcategory_model.pkl")
joblib.dump(department_model, "ml/models/department_model.pkl")

print("\nModels saved successfully.")



# 14. MANUAL TEST


print("\n")
print("=" * 50)
print("MANUAL TEST")
print("=" * 50)


complaint = [
    "I was charged twice for the same order and want one payment refunded."
]


category_prediction = category_model.predict(complaint)
subcategory_prediction = subcategory_model.predict(complaint)
department_prediction = department_model.predict(complaint)


print("\nComplaint:")
print(complaint[0])

print("\nPredicted Category:")
print(category_prediction[0])

print("\nPredicted Subcategory:")
print(subcategory_prediction[0])

print("\nPredicted Department:")
print(department_prediction[0])